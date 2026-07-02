// The Klimb climber's dictionary — the ~100 terms you'll actually hear at the
// gym, grouped for browsing. Tap a term in the UI to reveal its definition.

export type GlossaryTerm = {
  term: string;
  def: string;
  category: string;
};

export const GLOSSARY: GlossaryTerm[] = [
  // --- Holds -----------------------------------------------------------
  { category: "Holds", term: "Jug", def: "A big, deep hold you can wrap your whole hand around. The friendliest hold on the wall." },
  { category: "Holds", term: "Crimp", def: "A small edge only your fingertips fit on. 'Full crimp' wraps the thumb over your fingers for extra power." },
  { category: "Holds", term: "Sloper", def: "A rounded hold with no lip — you hold it with an open palm, friction, and hope." },
  { category: "Holds", term: "Pinch", def: "A hold you squeeze between thumb and fingers, like gripping a book spine." },
  { category: "Holds", term: "Pocket", def: "A hole in the wall or hold that fits one, two, or three fingers (mono, two-finger, three-finger pocket)." },
  { category: "Holds", term: "Edge", def: "A flat, narrow hold gripped with fingertips. Bigger than a crimp, smaller than a jug." },
  { category: "Holds", term: "Undercling", def: "A hold gripped from underneath, palm up. Strongest when your feet are high." },
  { category: "Holds", term: "Sidepull", def: "A vertical hold gripped from the side, pulling toward your body." },
  { category: "Holds", term: "Gaston", def: "A sidepull you push away from your body, elbow out — like opening elevator doors." },
  { category: "Holds", term: "Horn", def: "A protruding hold you can grab like a bike handle. Also called a bollard." },
  { category: "Holds", term: "Volume", def: "A large geometric feature bolted to the wall. Usually 'on' for every route unless the gym says otherwise." },
  { category: "Holds", term: "Chip", def: "A tiny foothold, sometimes barely bigger than a coin." },
  { category: "Holds", term: "Crack", def: "A fissure in the wall you jam hands, fingers, or feet into." },

  // --- Moves -----------------------------------------------------------
  { category: "Moves", term: "Dyno", def: "A dynamic jump move where you leave the wall completely to catch the next hold." },
  { category: "Moves", term: "Deadpoint", def: "A controlled dynamic move caught at the split second your body stops moving upward." },
  { category: "Moves", term: "Mantle", def: "Pressing down on a ledge to get your body above it, like getting out of a pool." },
  { category: "Moves", term: "Heel hook", def: "Placing your heel on a hold and pulling with your hamstring like a third arm." },
  { category: "Moves", term: "Toe hook", def: "Hooking the top of your toes behind a hold to keep your body from swinging out." },
  { category: "Moves", term: "Bicycle", def: "One foot pushing while the other toe-hooks the same hold — pinching it with your feet." },
  { category: "Moves", term: "Flag", def: "Extending a leg out to the side for balance instead of placing it on a hold." },
  { category: "Moves", term: "Drop knee", def: "Rotating a knee down and inward to bring your hip to the wall and extend your reach." },
  { category: "Moves", term: "Smear", def: "Pressing your shoe's rubber flat against blank wall for friction when there's no foothold." },
  { category: "Moves", term: "Stem", def: "Bridging between two opposing surfaces with your feet, like a chimney or corner." },
  { category: "Moves", term: "Layback", def: "Pulling on a vertical edge while pushing your feet against the wall in opposition." },
  { category: "Moves", term: "Match", def: "Putting both hands (or both feet) on the same hold." },
  { category: "Moves", term: "Bump", def: "A quick intermediate move — advancing the same hand to a better hold without settling." },
  { category: "Moves", term: "Cross", def: "Reaching one arm over or under the other to hit the next hold." },
  { category: "Moves", term: "Rose move", def: "A deep cross-through where one arm wraps behind the other — dramatic and elbow-scary." },
  { category: "Moves", term: "Lock-off", def: "Holding a pulled-up position with one arm bent and frozen while the other reaches." },
  { category: "Moves", term: "Campus", def: "Climbing with arms only, feet dangling. Also the training board for it." },
  { category: "Moves", term: "Knee bar", def: "Wedging your knee/thigh against a feature so hard you can let go with both hands." },
  { category: "Moves", term: "Rock-over", def: "Shifting all your weight up and over a high foot to stand on it." },
  { category: "Moves", term: "Hand jam", def: "Wedging your hand into a crack and expanding it to lock in place." },
  { category: "Moves", term: "Cut feet", def: "When your feet swing off the wall entirely, leaving you hanging by your hands." },

  // --- Grading & sends -------------------------------------------------
  { category: "Grading & sends", term: "Send", def: "Climbing a route bottom to top with no falls and no resting on the rope." },
  { category: "Grading & sends", term: "Flash", def: "Sending a route on your very first try, possibly with beta from others." },
  { category: "Grading & sends", term: "Onsight", def: "Sending first try with zero prior info — no watching, no beta, no chalk marks." },
  { category: "Grading & sends", term: "Redpoint", def: "Sending a route after practicing it. The standard way hard projects go down." },
  { category: "Grading & sends", term: "Project", def: "A route at your limit you're working on over multiple sessions." },
  { category: "Grading & sends", term: "Beta", def: "Information about how to do a route's moves. 'Spraying beta' is giving it unasked." },
  { category: "Grading & sends", term: "Crux", def: "The hardest move or sequence on a route — where it usually spits you off." },
  { category: "Grading & sends", term: "Sandbag", def: "A route graded easier than it really is. 'That V3 is a sandbag.'" },
  { category: "Grading & sends", term: "Soft", def: "A route graded harder than it feels. The opposite of sandbagged." },
  { category: "Grading & sends", term: "V-scale", def: "American bouldering grades, V0 to V17. Named for Vermin, a Hueco Tanks legend." },
  { category: "Grading & sends", term: "YDS", def: "Yosemite Decimal System — American rope grades like 5.9, 5.10a, 5.12d." },
  { category: "Grading & sends", term: "Font scale", def: "European bouldering grades (4, 6A, 7C+…) from Fontainebleau, France." },
  { category: "Grading & sends", term: "French scale", def: "European rope grades (5c, 6a+, 8b…) used at most gyms outside the US." },
  { category: "Grading & sends", term: "Highpoint", def: "The farthest you've gotten on a route you haven't sent yet." },
  { category: "Grading & sends", term: "Repeat", def: "Sending a route you've already sent before." },
  { category: "Grading & sends", term: "Circuit", def: "A set of problems, often color-coded by difficulty band, meant to be climbed in a session." },

  // --- Gym & gear -------------------------------------------------------
  { category: "Gym & gear", term: "Bouldering", def: "Ropeless climbing on short walls over thick pads. Falls are part of the sport." },
  { category: "Gym & gear", term: "Top rope", def: "Climbing with the rope already anchored at the top — the gentlest way to climb high walls." },
  { category: "Gym & gear", term: "Lead climbing", def: "Clipping the rope into quickdraws as you climb. Falls are longer; heads must be cooler." },
  { category: "Gym & gear", term: "Auto belay", def: "A device that takes rope slack automatically so you can climb tall walls alone." },
  { category: "Gym & gear", term: "Belay", def: "Managing the rope for a climbing partner — their life is literally in your hands." },
  { category: "Gym & gear", term: "Quickdraw", def: "Two carabiners on a sling; lead climbers clip the rope through them." },
  { category: "Gym & gear", term: "Chalk", def: "Magnesium carbonate for drying sweaty hands. Comes loose, in balls, or liquid." },
  { category: "Gym & gear", term: "Chalk bag", def: "The pouch of chalk on your waist. A chalk 'bucket' is the floor version for bouldering." },
  { category: "Gym & gear", term: "Crash pad", def: "The thick foam mat under boulder problems, in gyms and outdoors." },
  { category: "Gym & gear", term: "Harness", def: "The waist-and-legs rig that connects you to the rope." },
  { category: "Gym & gear", term: "ATC / GriGri", def: "Belay devices — ATC is manual, GriGri has assisted braking." },
  { category: "Gym & gear", term: "Approach shoes", def: "Sticky-soled shoes for hiking to outdoor crags. Gym rats call them 'nice sneakers.'" },
  { category: "Gym & gear", term: "Aggressive shoes", def: "Downturned, tight climbing shoes built for steep walls and tiny holds." },
  { category: "Gym & gear", term: "Setter", def: "The person who designs and bolts routes onto the wall. Praise them; fear them." },
  { category: "Gym & gear", term: "Reset", def: "When a wall's routes are stripped and replaced with new ones." },
  { category: "Gym & gear", term: "Kilter board", def: "A standardized, adjustable-angle LED training board with a shared app of problems (see also MoonBoard, Tension board)." },
  { category: "Gym & gear", term: "Hangboard", def: "A fingerboard mounted over a doorway for building finger strength. Use responsibly." },

  // --- Wall features ----------------------------------------------------
  { category: "Wall features", term: "Overhang", def: "Wall steeper than vertical, leaning over you. Pump city." },
  { category: "Wall features", term: "Slab", def: "Wall less steep than vertical. All balance, feet, and fear — your arms can't save you." },
  { category: "Wall features", term: "Roof", def: "A horizontal ceiling section. You climb it hanging like a bat." },
  { category: "Wall features", term: "Arete", def: "An outside corner of the wall, climbed by pinching and laybacking its edge." },
  { category: "Wall features", term: "Dihedral", def: "An inside corner, like an open book. Stemming territory." },
  { category: "Wall features", term: "Face", def: "A flat, vertical wall section climbed on holds rather than features." },
  { category: "Wall features", term: "Topout", def: "Finishing a boulder by climbing over its top, rather than matching a finish hold." },
  { category: "Wall features", term: "Cave", def: "The steepest, most overhung section of the gym. Where the wildest problems live." },
  { category: "Wall features", term: "Bulge", def: "A rounded, protruding section of wall — briefly steep, awkward to pass." },

  // --- Body & technique -------------------------------------------------
  { category: "Body & technique", term: "Pumped", def: "Forearms so flooded with fatigue you can barely close your hands. Terminal on long routes." },
  { category: "Body & technique", term: "Flash pump", def: "Getting pumped abnormally fast because you didn't warm up. Rookies and eager veterans alike." },
  { category: "Body & technique", term: "Gassed", def: "Out of energy entirely — beyond pumped." },
  { category: "Body & technique", term: "Barn door", def: "When your body swings open sideways like a door on hinges because your balance is off." },
  { category: "Body & technique", term: "Body tension", def: "Core strength keeping your feet pressed on holds when the wall gets steep." },
  { category: "Body & technique", term: "Open hand", def: "Gripping with relaxed, extended fingers — easier on the tendons than crimping." },
  { category: "Body & technique", term: "Hip in", def: "Turning a hip to the wall to extend reach and take weight off your arms." },
  { category: "Body & technique", term: "Static", def: "Slow, controlled movement — the opposite of dynamic. Strong climbers make it look easy." },
  { category: "Body & technique", term: "Dynamic", def: "Using momentum to reach holds — efficient when controlled, wild when not." },
  { category: "Body & technique", term: "Silent feet", def: "Placing feet precisely and quietly — the classic drill for footwork." },
  { category: "Body & technique", term: "Straight arms", def: "Hanging on your skeleton instead of bent arms to save energy between moves." },
  { category: "Body & technique", term: "Flapper", def: "A flap of torn skin, usually from a jug or campus session. Tape it and cry." },
  { category: "Body & technique", term: "Gobies", def: "Scrapes on the back of your hands, usually from cracks." },
  { category: "Body & technique", term: "Split tip", def: "A crack in your fingertip skin from crimping. Ends sessions." },

  // --- Culture & slang ---------------------------------------------------
  { category: "Culture & slang", term: "Allez", def: "French for 'go!' — yelled at climbers mid-crux worldwide." },
  { category: "Culture & slang", term: "Venga", def: "The Spanish 'come on!' Same energy as allez." },
  { category: "Culture & slang", term: "Take", def: "Called to your belayer to take rope tension so you can rest (or give up gracefully)." },
  { category: "Culture & slang", term: "Falling!", def: "The courtesy shout right before you test the pads or the rope." },
  { category: "Culture & slang", term: "Spot", def: "Guiding a falling boulderer safely onto the pad with raised hands." },
  { category: "Culture & slang", term: "Whipper", def: "A big lead fall. The longer the fall, the better the story." },
  { category: "Culture & slang", term: "Choss", def: "Loose, crumbly, bad rock. 'Chossy' gym holds are spinny or greasy ones." },
  { category: "Culture & slang", term: "Greasy", def: "Holds slick with humidity, sweat, or overuse. Conditions matter." },
  { category: "Culture & slang", term: "Crimpy", def: "A route whose holds are mostly crimps. Say it with a wince." },
  { category: "Culture & slang", term: "Reachy", def: "A route that favors tall climbers. Short climbers say 'morpho'; setters say 'sorry.'" },
  { category: "Culture & slang", term: "Beta break", def: "Finding an easier sequence than intended — sometimes making the grade a lie." },
  { category: "Culture & slang", term: "Morpho", def: "A route whose difficulty depends heavily on your body dimensions." },
  { category: "Culture & slang", term: "Send train", def: "When one person sends and suddenly everyone in the session sends too. All aboard." },
  { category: "Culture & slang", term: "Psyched", def: "Fired up to climb. The whole point." },
  { category: "Culture & slang", term: "Mega", def: "Universal climber adjective for anything great. 'That heel hook is mega.'" },
  { category: "Culture & slang", term: "Dab", def: "Accidentally touching the pad, wall, or another hold mid-problem — purists call the attempt dead." },
  { category: "Culture & slang", term: "Chuffer", def: "Affectionate British slang for an enthusiastic, technique-free climber. We've all been one." },
  { category: "Culture & slang", term: "Crusher", def: "Someone who climbs everything, effortlessly. Usually humble. Usually wearing a hoodie." },
];

export const GLOSSARY_CATEGORIES = [...new Set(GLOSSARY.map((t) => t.category))];
