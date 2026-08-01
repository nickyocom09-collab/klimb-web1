import UIKit
import Capacitor
import StoreKit
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

// MARK: - Bridge view controller with explicit local-plugin registration
//
// Capacitor's automatic plugin discovery can miss plugins defined in the app
// target (as ours are, below), which surfaces in JS as
// "<Plugin> not implemented on iOS". Registering each instance explicitly in
// capacitorDidLoad() guarantees the app-local native plugins are always
// available. The Main storyboard points its bridge scene at this class
// (customClass="MainViewController", module "App").
class MainViewController: CAPBridgeViewController {
    private var launchOverlay: UIView?

    // Apply the saved theme to the native chrome before the first frame so the
    // status bar / scroll bounce never flash the opposite theme. This is safe
    // for the splash: the splash keys off the saved theme in localStorage, not
    // `prefers-color-scheme`, so overriding the trait can't desync it.
    override func viewWillAppear(_ animated: Bool) {
        ThemeAppearancePlugin.applySavedTheme(to: self)
        super.viewWillAppear(animated)
        if let launchOverlay {
            view.bringSubviewToFront(launchOverlay)
        }
    }

    /// Paint the web container with the same adaptive colour as the launch
    /// screen. WKWebView defaults to white, which flashed through as a harsh
    /// white frame between the launch screen disappearing and the first web
    /// paint. Assigning the *named* asset colour (rather than a resolved one)
    /// means it tracks the launch appearance at boot and then re-resolves
    /// automatically once the saved theme is applied.
    override func viewDidLoad() {
        super.viewDidLoad()
        guard let launchColor = UIColor(named: "LaunchBackground") else { return }
        view.backgroundColor = launchColor
        webView?.isOpaque = false
        webView?.backgroundColor = launchColor
        webView?.scrollView.backgroundColor = launchColor
        installLaunchOverlay(backgroundColor: launchColor)
    }

    /// iOS owns the transition away from LaunchScreen.storyboard and begins
    /// fading that snapshot before WKWebView is guaranteed to have painted.
    /// Keep an identical native layer above the WebView during that gap so the
    /// mark cannot dim and then flash bright again when HTML appears.
    private func installLaunchOverlay(backgroundColor: UIColor) {
        guard launchOverlay == nil else { return }

        let overlay = UIView()
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.backgroundColor = backgroundColor
        overlay.isUserInteractionEnabled = false
        overlay.accessibilityElementsHidden = true

        let mark = UIImageView(image: UIImage(named: "Splash"))
        mark.translatesAutoresizingMaskIntoConstraints = false
        mark.contentMode = .scaleAspectFit

        overlay.addSubview(mark)
        view.addSubview(overlay)
        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            overlay.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            overlay.topAnchor.constraint(equalTo: view.topAnchor),
            overlay.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            mark.centerXAnchor.constraint(equalTo: overlay.centerXAnchor),
            mark.centerYAnchor.constraint(equalTo: overlay.centerYAnchor),
            mark.widthAnchor.constraint(equalToConstant: 224),
            mark.heightAnchor.constraint(equalToConstant: 224),
        ])
        UIView.performWithoutAnimation {
            view.layoutIfNeeded()
        }
        launchOverlay = overlay
    }

    func dismissLaunchOverlay() {
        guard let launchOverlay else { return }
        UIView.performWithoutAnimation {
            launchOverlay.removeFromSuperview()
        }
        self.launchOverlay = nil
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppleSignInPlugin())
        bridge?.registerPluginInstance(WebAuthenticationPlugin())
        bridge?.registerPluginInstance(InstagramStoriesPlugin())
        bridge?.registerPluginInstance(MessageComposePlugin())
        bridge?.registerPluginInstance(ThemeAppearancePlugin())
        bridge?.registerPluginInstance(LaunchOverlayPlugin())
        bridge?.registerPluginInstance(KlimbStoreKitPlugin())
    }
}

// MARK: - StoreKit 2 subscriptions
//
// Keeps Apple's purchase UI and transaction verification in the native layer.
// The signed JWS is then verified again by Klimb's server before the app grants
// access or finishes the transaction.
@objc(KlimbStoreKitPlugin)
public class KlimbStoreKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KlimbStoreKitPlugin"
    public let jsName = "KlimbStoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "loadProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "currentEntitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishTransaction", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manageSubscriptions", returnType: CAPPluginReturnPromise),
    ]

    private var transactionUpdatesTask: Task<Void, Never>?

    public override func load() {
        transactionUpdatesTask = Task { [weak self] in
            for await result in Transaction.updates {
                guard !Task.isCancelled, let self else { return }
                switch result {
                case .verified(let transaction):
                    self.notifyListeners(
                        "transactionUpdated",
                        data: Self.transactionPayload(
                            transaction,
                            signedTransaction: result.jwsRepresentation
                        )
                    )
                case .unverified(_, let error):
                    self.notifyListeners(
                        "transactionVerificationFailed",
                        data: ["message": error.localizedDescription]
                    )
                }
            }
        }
    }

    deinit {
        transactionUpdatesTask?.cancel()
    }

    @objc func loadProducts(_ call: CAPPluginCall) {
        guard let productIds = call.getArray("productIds", String.self),
              !productIds.isEmpty else {
            call.reject("At least one product identifier is required")
            return
        }

        Task {
            do {
                let products = try await Product.products(for: productIds)
                var payloads: [[String: Any]] = []
                for product in products {
                    payloads.append(await Self.productPayload(product))
                }
                call.resolve(["products": payloads])
            } catch {
                call.reject("Apple pricing is temporarily unavailable", nil, error)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"),
              let accountTokenValue = call.getString("appAccountToken"),
              let accountToken = UUID(uuidString: accountTokenValue) else {
            call.reject("A product and valid account token are required")
            return
        }

        Task {
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("This subscription is not available from Apple")
                    return
                }
                let result = try await product.purchase(options: [
                    .appAccountToken(accountToken),
                ])
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        var payload = Self.transactionPayload(
                            transaction,
                            signedTransaction: verification.jwsRepresentation
                        )
                        payload["state"] = "purchased"
                        call.resolve(payload)
                    case .unverified(_, let error):
                        self.notifyListeners(
                            "transactionVerificationFailed",
                            data: ["message": error.localizedDescription]
                        )
                        call.reject("Apple could not verify this purchase", nil, error)
                    }
                case .pending:
                    call.resolve(["state": "pending"])
                case .userCancelled:
                    call.resolve(["state": "canceled"])
                @unknown default:
                    call.reject("Apple returned an unknown purchase state")
                }
            } catch {
                call.reject("The purchase could not be completed", nil, error)
            }
        }
    }

    @objc func currentEntitlements(_ call: CAPPluginCall) {
        Task {
            call.resolve(["transactions": await Self.verifiedCurrentEntitlements()])
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                call.resolve(["transactions": await Self.verifiedCurrentEntitlements()])
            } catch {
                call.reject("Purchases could not be restored", nil, error)
            }
        }
    }

    @objc func finishTransaction(_ call: CAPPluginCall) {
        guard let transactionId = call.getString("transactionId"),
              let numericId = UInt64(transactionId) else {
            call.reject("A valid transaction identifier is required")
            return
        }

        Task {
            for await result in Transaction.unfinished {
                guard case .verified(let transaction) = result else { continue }
                if transaction.id == numericId {
                    await transaction.finish()
                    call.resolve()
                    return
                }
            }
            // StoreKit may already have finished an idempotently replayed
            // transaction. Treat that as success after server verification.
            call.resolve()
        }
    }

    @objc func manageSubscriptions(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("No active window is available")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject("Subscription settings could not be opened", nil, error)
            }
        }
    }

    private static func verifiedCurrentEntitlements() async -> [[String: Any]] {
        var transactions: [[String: Any]] = []
        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            transactions.append(transactionPayload(
                transaction,
                signedTransaction: result.jwsRepresentation
            ))
        }
        return transactions
    }

    private static func transactionPayload(
        _ transaction: Transaction,
        signedTransaction: String
    ) -> [String: Any] {
        [
            "transactionId": String(transaction.id),
            "signedTransaction": signedTransaction,
        ]
    }

    private static func productPayload(_ product: Product) async -> [String: Any] {
        var payload: [String: Any] = [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
        ]
        guard let subscription = product.subscription else { return payload }

        payload["period"] = periodPayload(subscription.subscriptionPeriod)
        payload["isEligibleForIntroOffer"] = await subscription.isEligibleForIntroOffer
        if let offer = subscription.introductoryOffer {
            payload["introductoryOffer"] = [
                "displayPrice": offer.displayPrice,
                "paymentMode": paymentModeName(offer.paymentMode),
                "period": periodPayload(offer.period),
            ]
        }
        return payload
    }

    private static func periodPayload(_ period: Product.SubscriptionPeriod) -> [String: Any] {
        let unit: String
        switch period.unit {
        case .day: unit = "day"
        case .week: unit = "week"
        case .month: unit = "month"
        case .year: unit = "year"
        @unknown default: unit = "period"
        }
        return ["value": period.value, "unit": unit]
    }

    private static func paymentModeName(_ mode: Product.SubscriptionOffer.PaymentMode) -> String {
        switch mode {
        case .freeTrial: return "freeTrial"
        case .payAsYouGo: return "payAsYouGo"
        case .payUpFront: return "payUpFront"
        default: return "unknown"
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.async { [weak self] in
            ThemeAppearancePlugin.applySavedTheme(to: self?.window?.rootViewController)
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(
            name: .capacitorDidRegisterForRemoteNotifications,
            object: deviceToken
        )
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(
            name: .capacitorDidFailToRegisterForRemoteNotifications,
            object: error
        )
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
#if canImport(GoogleSignIn)
        if GIDSignIn.sharedInstance.handle(url) {
            return true
        }
#endif
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - Saved app appearance
//
// The web theme is persisted in localStorage, but the native container exists
// before the WebView does. Mirroring that preference into UserDefaults lets the
// first native view and the web splash agree instead of visibly changing color
// during the handoff.
@objc(ThemeAppearancePlugin)
public class ThemeAppearancePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ThemeAppearancePlugin"
    public let jsName = "ThemeAppearance"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTheme", returnType: CAPPluginReturnPromise),
    ]

    private static let defaultsKey = "klimb.savedTheme"

    private static var savedStyle: UIUserInterfaceStyle {
        switch UserDefaults.standard.string(forKey: defaultsKey) {
        case "light":
            return .light
        case "dark":
            return .dark
        default:
            return .unspecified
        }
    }

    public static func applySavedTheme(to viewController: UIViewController?) {
        let style = savedStyle
        guard style != .unspecified else { return }
        viewController?.overrideUserInterfaceStyle = style
        viewController?.view.window?.overrideUserInterfaceStyle = style
    }

    @objc func setTheme(_ call: CAPPluginCall) {
        guard let theme = call.getString("theme"),
              theme == "light" || theme == "dark" else {
            call.reject("Theme must be light or dark")
            return
        }

        UserDefaults.standard.set(theme, forKey: Self.defaultsKey)
        DispatchQueue.main.async {
            let style: UIUserInterfaceStyle = theme == "light" ? .light : .dark
            self.bridge?.viewController?.overrideUserInterfaceStyle = style
            self.bridge?.viewController?.view.window?.overrideUserInterfaceStyle = style
            call.resolve()
        }
    }
}

// MARK: - Seamless native-to-web launch handoff

@objc(LaunchOverlayPlugin)
public class LaunchOverlayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LaunchOverlayPlugin"
    public let jsName = "LaunchOverlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "dismiss", returnType: CAPPluginReturnPromise),
    ]

    @objc func dismiss(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? MainViewController)?.dismissLaunchOverlay()
            call.resolve()
        }
    }
}

// MARK: - Instagram Stories direct-share ("Strava-style" share to story)
//
// Lets the Weekly Recap screen hand a rendered image straight to Instagram's
// Stories composer instead of the generic OS share sheet. Uses Instagram's
// documented custom URL scheme + pasteboard handoff — no Instagram API
// review required, just a Facebook App ID for attribution.
// Docs: https://developers.facebook.com/docs/instagram/sharing-to-stories
//
// Declared here (rather than a separate file) so it compiles into the App
// target automatically without needing an Xcode project file reference.
@objc(InstagramStoriesPlugin)
public class InstagramStoriesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InstagramStoriesPlugin"
    public let jsName = "InstagramStories"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareToStory", returnType: CAPPluginReturnPromise),
    ]

    private let schemeURL = URL(string: "instagram-stories://share")!

    /// Whether Instagram is installed and can accept a direct Stories share.
    @objc func isAvailable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["available": UIApplication.shared.canOpenURL(self.schemeURL)])
        }
    }

    /// Hands a background image (and optional sticker image) to Instagram's
    /// Stories composer. `backgroundImageBase64` / `stickerImageBase64` are
    /// raw base64 PNG/JPEG data (no data: URL prefix).
    @objc func shareToStory(_ call: CAPPluginCall) {
        guard let appId = call.getString("appId"), !appId.isEmpty else {
            call.reject("Missing Facebook appId")
            return
        }
        guard let backgroundImageBase64 = call.getString("backgroundImageBase64"),
              let imageData = Data(base64Encoded: backgroundImageBase64) else {
            call.reject("Missing or invalid backgroundImageBase64")
            return
        }
        // Instagram attributes the Story to this Meta app. Reject malformed
        // values early instead of handing Instagram a URL it will ignore.
        let cleanedAppId = appId.trimmingCharacters(in: .whitespacesAndNewlines)
        guard cleanedAppId.allSatisfy({ $0.isNumber }),
              let url = URL(string: "instagram-stories://share?source_application=\(cleanedAppId)") else {
            call.reject("Could not build Instagram share URL")
            return
        }

        DispatchQueue.main.async {
            guard UIApplication.shared.canOpenURL(url) else {
                call.reject("INSTAGRAM_NOT_INSTALLED")
                return
            }

            var pasteboardItem: [String: Any] = [
                "com.instagram.sharedSticker.backgroundImage": imageData
            ]
            if let stickerBase64 = call.getString("stickerImageBase64"),
               let stickerData = Data(base64Encoded: stickerBase64) {
                pasteboardItem["com.instagram.sharedSticker.stickerImage"] = stickerData
            }

            let pasteboardOptions = [UIPasteboard.OptionsKey.expirationDate: Date().addingTimeInterval(60 * 5)]
            UIPasteboard.general.setItems([pasteboardItem], options: pasteboardOptions)

            UIApplication.shared.open(url, options: [:]) { success in
                if success {
                    call.resolve()
                } else {
                    call.reject("Failed to open Instagram")
                }
            }
        }
    }
}

// MARK: - Native Sign In with Apple
//
// Uses AuthenticationServices directly (ASAuthorizationController) instead
// of Supabase's browser-based OAuth redirect, so the whole flow happens in
// the native system sheet — no bounce out to Safari/appleid.apple.com.
// The resulting identity token + raw nonce get handed back to JS, which
// exchanges them with Supabase via `signInWithIdToken`.
import AuthenticationServices
import CryptoKit

// MARK: - In-app web authentication
//
// Runs Google/Supabase OAuth in Apple's secure authentication sheet. Unlike
// opening Safari and waiting for an appUrlOpen event, ASWebAuthenticationSession
// returns the callback URL directly to this app process. It is also the
// system-owned browser surface required by Google's OAuth security policy.
@objc(WebAuthenticationPlugin)
public class WebAuthenticationPlugin: CAPPlugin, CAPBridgedPlugin, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "WebAuthenticationPlugin"
    public let jsName = "WebAuthentication"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
    ]

    private var authenticationSession: ASWebAuthenticationSession?
    private var pendingCall: CAPPluginCall?
    private var redirectTask: URLSessionDataTask?

    @objc func authenticate(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let callbackScheme = call.getString("callbackScheme"),
              !callbackScheme.isEmpty else {
            call.reject("Missing or invalid authentication URL")
            return
        }

        if let existingCall = pendingCall {
            existingCall.reject("A new sign-in attempt was started")
            authenticationSession?.cancel()
        }
        pendingCall = call

        // Supabase's authorize endpoint immediately redirects to the selected
        // identity provider. Resolve that redirect before presenting Apple's
        // sheet so its consent copy names accounts.google.com/appleid.apple.com
        // instead of exposing the raw project-ref.supabase.co hostname.
        redirectTask?.cancel()
        redirectTask = URLSession.shared.dataTask(with: url) { [weak self] _, response, _ in
            guard let self else { return }
            let resolvedURL = response?.url
            let providerHost = resolvedURL?.host?.lowercased() ?? ""
            let startURL =
                providerHost.contains("google.com") || providerHost.contains("apple.com")
                    ? resolvedURL!
                    : url
            DispatchQueue.main.async {
                guard self.pendingCall === call else { return }
                self.startAuthenticationSession(
                    url: startURL,
                    callbackScheme: callbackScheme
                )
            }
        }
        redirectTask?.resume()
    }

    private func startAuthenticationSession(url: URL, callbackScheme: String) {
        let session = ASWebAuthenticationSession(
            url: url,
            callbackURLScheme: callbackScheme
        ) { [weak self] callbackURL, error in
            guard let self else { return }
            defer {
                self.pendingCall = nil
                self.authenticationSession = nil
                self.redirectTask = nil
            }

            if let callbackURL {
                self.pendingCall?.resolve(["callbackUrl": callbackURL.absoluteString])
                return
            }

            if let authError = error as? ASWebAuthenticationSessionError,
               authError.code == .canceledLogin {
                self.pendingCall?.reject("CANCELED")
            } else {
                self.pendingCall?.reject(error?.localizedDescription ?? "Google sign-in failed")
            }
        }

        session.presentationContextProvider = self
        session.prefersEphemeralWebBrowserSession = false
        authenticationSession = session

        DispatchQueue.main.async {
            if !session.start() {
                self.pendingCall?.reject("Could not present Google sign-in")
                self.pendingCall = nil
                self.authenticationSession = nil
                self.redirectTask = nil
            }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window
            ?? UIApplication.shared.windows.first { $0.isKeyWindow }
            ?? UIWindow()
    }
}

@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
    ]

    private var pendingCall: CAPPluginCall?
    private var currentNonce: String?

    @objc func signIn(_ call: CAPPluginCall) {
        pendingCall = call
        let nonce = randomNonceString()
        currentNonce = nonce

        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        DispatchQueue.main.async {
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return UIApplication.shared.windows.first { $0.isKeyWindow } ?? UIWindow()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            pendingCall?.reject("Missing identity token")
            pendingCall = nil
            currentNonce = nil
            return
        }

        var result: [String: Any] = [
            "identityToken": identityToken,
            "nonce": currentNonce ?? "",
            "userIdentifier": credential.user,
        ]
        if let email = credential.email {
            result["email"] = email
        }
        if let fullName = credential.fullName {
            let name = PersonNameComponentsFormatter().string(from: fullName)
            if !name.isEmpty { result["fullName"] = name }
        }

        pendingCall?.resolve(result)
        pendingCall = nil
        currentNonce = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let nsError = error as NSError
        if nsError.domain == ASAuthorizationError.errorDomain,
           nsError.code == ASAuthorizationError.canceled.rawValue {
            pendingCall?.reject("CANCELED")
        } else {
            pendingCall?.reject(error.localizedDescription)
        }
        pendingCall = nil
        currentNonce = nil
    }

    private func randomNonceString(length: Int = 32) -> String {
        var randomBytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        precondition(status == errSecSuccess, "Unable to generate nonce")
        let charset: [Character] = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(randomBytes.map { charset[Int($0) % charset.count] })
    }

    private func sha256(_ input: String) -> String {
        let hashed = SHA256.hash(data: Data(input.utf8))
        return hashed.compactMap { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Native Message (SMS/iMessage) compose
//
// Opens the system Messages composer directly with the recap image attached
// — a dedicated "Message" share target (like Strava's), instead of routing
// through the full OS share sheet.
import MessageUI

@objc(MessageComposePlugin)
public class MessageComposePlugin: CAPPlugin, CAPBridgedPlugin, MFMessageComposeViewControllerDelegate {
    public let identifier = "MessageComposePlugin"
    public let jsName = "MessageCompose"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
    ]

    private var pendingCall: CAPPluginCall?

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": MFMessageComposeViewController.canSendText()])
    }

    @objc func send(_ call: CAPPluginCall) {
        guard MFMessageComposeViewController.canSendText() else {
            call.reject("MESSAGES_NOT_AVAILABLE")
            return
        }
        pendingCall = call

        DispatchQueue.main.async {
            let composer = MFMessageComposeViewController()
            composer.messageComposeDelegate = self
            if let body = call.getString("text") {
                composer.body = body
            }
            if let imageBase64 = call.getString("imageBase64"),
               let imageData = Data(base64Encoded: imageBase64),
               MFMessageComposeViewController.canSendAttachments() {
                composer.addAttachmentData(imageData, typeIdentifier: "public.png", filename: "klimb-week.png")
            }

            guard var top = UIApplication.shared.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
                call.reject("No root view controller")
                self.pendingCall = nil
                return
            }
            while let presented = top.presentedViewController { top = presented }
            top.present(composer, animated: true)
        }
    }

    public func messageComposeViewController(_ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult) {
        controller.dismiss(animated: true) {
            switch result {
            case .sent:
                self.pendingCall?.resolve(["sent": true])
            case .cancelled:
                self.pendingCall?.resolve(["sent": false])
            case .failed:
                self.pendingCall?.reject("SEND_FAILED")
            @unknown default:
                self.pendingCall?.resolve(["sent": false])
            }
            self.pendingCall = nil
        }
    }
}
