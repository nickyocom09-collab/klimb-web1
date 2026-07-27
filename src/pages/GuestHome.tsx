import { Navigate, useNavigate } from "react-router-dom";
import { IntroTutorial, INTRO_SEEN_KEY } from "../components/IntroTutorial";

export function GuestHome() {
  const navigate = useNavigate();
  const showIntro = (() => {
    try {
      return !localStorage.getItem(INTRO_SEEN_KEY);
    } catch {
      return false;
    }
  })();

  if (showIntro) {
    return <IntroTutorial onDone={() => navigate("/signup", { replace: true })} />;
  }

  return <Navigate to="/login" replace />;
}
