# Graph Report - src  (2026-06-07)

## Corpus Check
- 164 files · ~80,516 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1050 nodes · 1953 edges · 61 communities (54 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Data Store & Persistence|Data Store & Persistence]]
- [[_COMMUNITY_Critical Moment Drills|Critical Moment Drills]]
- [[_COMMUNITY_Coach Diagnostic & Program|Coach Diagnostic & Program]]
- [[_COMMUNITY_Spaced Repetition (FSRS)|Spaced Repetition (FSRS)]]
- [[_COMMUNITY_Board Vision & Geometry|Board Vision & Geometry]]
- [[_COMMUNITY_Stockfish Engine Client|Stockfish Engine Client]]
- [[_COMMUNITY_Board & Training UI Hub|Board & Training UI Hub]]
- [[_COMMUNITY_Endgame Tablebase (Syzygy)|Endgame Tablebase (Syzygy)]]
- [[_COMMUNITY_Clock & Time Controls|Clock & Time Controls]]
- [[_COMMUNITY_Metacognition Tagging|Metacognition Tagging]]
- [[_COMMUNITY_Positional Explanation|Positional Explanation]]
- [[_COMMUNITY_Tactical Motif Detection|Tactical Motif Detection]]
- [[_COMMUNITY_Concept Cards|Concept Cards]]
- [[_COMMUNITY_Adaptive Human Opponent|Adaptive Human Opponent]]
- [[_COMMUNITY_Analysis Run & Puzzle Gen|Analysis Run & Puzzle Gen]]
- [[_COMMUNITY_Weakness Profiling|Weakness Profiling]]
- [[_COMMUNITY_Dashboard & Insights UI|Dashboard & Insights UI]]
- [[_COMMUNITY_Rating Calibration|Rating Calibration]]
- [[_COMMUNITY_Critical Moments Analysis|Critical Moments Analysis]]
- [[_COMMUNITY_Tactical Trainer|Tactical Trainer]]
- [[_COMMUNITY_ChessGame FEN & Castling|ChessGame FEN & Castling]]
- [[_COMMUNITY_Study Plan & Fingerprint|Study Plan & Fingerprint]]
- [[_COMMUNITY_Coach UI Ladders|Coach UI Ladders]]
- [[_COMMUNITY_Glicko-2 Rating|Glicko-2 Rating]]
- [[_COMMUNITY_Batch Analyzer & Win Prob|Batch Analyzer & Win Prob]]
- [[_COMMUNITY_App Shell & Routing|App Shell & Routing]]
- [[_COMMUNITY_Session Builder|Session Builder]]
- [[_COMMUNITY_Efficacy Test Fixtures|Efficacy Test Fixtures]]
- [[_COMMUNITY_Fingerprint Test Fixtures|Fingerprint Test Fixtures]]
- [[_COMMUNITY_Scenario Sparring|Scenario Sparring]]
- [[_COMMUNITY_Opening Book|Opening Book]]
- [[_COMMUNITY_Analysis Result UI|Analysis Result UI]]
- [[_COMMUNITY_Play & Onboarding UI|Play & Onboarding UI]]
- [[_COMMUNITY_Lapse Scheduling|Lapse Scheduling]]
- [[_COMMUNITY_Guess-the-Move|Guess-the-Move]]
- [[_COMMUNITY_Puzzle Repository|Puzzle Repository]]
- [[_COMMUNITY_PGN Parsing|PGN Parsing]]
- [[_COMMUNITY_Chess960 Castling Tests|Chess960 Castling Tests]]
- [[_COMMUNITY_ChessGame Types & 960|ChessGame Types & 960]]
- [[_COMMUNITY_ECO Opening Codes|ECO Opening Codes]]
- [[_COMMUNITY_Vision Stats|Vision Stats]]
- [[_COMMUNITY_Master Games Data|Master Games Data]]
- [[_COMMUNITY_Comeback Detection|Comeback Detection]]
- [[_COMMUNITY_Chess960 Position Tests|Chess960 Position Tests]]
- [[_COMMUNITY_Tactics Vision Scan|Tactics Vision Scan]]
- [[_COMMUNITY_Motif Efficacy|Motif Efficacy]]
- [[_COMMUNITY_Puzzle Repo Internals|Puzzle Repo Internals]]
- [[_COMMUNITY_Chess960 Position Gen|Chess960 Position Gen]]
- [[_COMMUNITY_Vision Training UI|Vision Training UI]]
- [[_COMMUNITY_Calculation Drill|Calculation Drill]]
- [[_COMMUNITY_Puzzle Ladder|Puzzle Ladder]]
- [[_COMMUNITY_Concept Card Board Tests|Concept Card Board Tests]]
- [[_COMMUNITY_Castling Move Generation|Castling Move Generation]]
- [[_COMMUNITY_Move Application & Rights|Move Application & Rights]]
- [[_COMMUNITY_Board Turn-Color Test|Board Turn-Color Test]]
- [[_COMMUNITY_Endgames UI|Endgames UI]]
- [[_COMMUNITY_Endgame Drills Data|Endgame Drills Data]]
- [[_COMMUNITY_Board Reactivity|Board Reactivity]]

## God Nodes (most connected - your core abstractions)
1. `../store/db` - 42 edges
2. `../analysis/types` - 35 edges
3. `openTrainerDB()` - 35 edges
4. `ChessGame` - 29 edges
5. `../state/app.svelte` - 22 edges
6. `./Board.svelte` - 22 edges
7. `GameAnalysis` - 20 edges
8. `../game/ChessGame` - 20 edges
9. `PlyAnalysis` - 18 edges
10. `EngineClient` - 18 edges

## Surprising Connections (you probably didn't know these)
- `updateRating()` --calls--> `f`  [INFERRED]
  rating/glicko2.ts → analysis/positional.test.ts
- `finishGame()` --calls--> `runAnalysis()`  [INFERRED]
  ui/Coach.svelte → analysis/runAnalysis.ts
- `loadAllAnalyses()` --calls--> `openTrainerDB()`  [EXTRACTED]
  analysis/runAnalysis.ts → store/db.ts
- `finishGame()` --calls--> `buildWeaknessProfile()`  [INFERRED]
  ui/Coach.svelte → analysis/weakness.ts
- `startGame()` --calls--> `initOpponentState()`  [INFERRED]
  ui/Coach.svelte → engine/AdaptiveOpponent.ts

## Communities (61 total, 7 thin omitted)

### Community 0 - "Data Store & Persistence"
Cohesion: 0.05
Nodes (69): defaultRating(), fresh, legacyRecord(), m, raw, RatingPool, STANDARD_POOLS, all (+61 more)

### Community 1 - "Critical Moment Drills"
Cohesion: 0.06
Nodes (36): buildDrillSet(), CallResult, DEFAULTS, DrillItem, DrillLabel, DrillOptions, isTrivialRecapture(), labelPly() (+28 more)

### Community 2 - "Coach Diagnostic & Program"
Cohesion: 0.07
Nodes (34): DimensionScore, ALL_DIMS, buildCoachProfile(), clamp(), COACH_MOTIF_PROBES, DIM_LABELS, MOTIF_LABELS, motifAggregateScore() (+26 more)

### Community 3 - "Spaced Repetition (FSRS)"
Cohesion: 0.09
Nodes (33): cardToRecord(), DEFAULT_GRADE_THRESHOLDS, Grade, gradeCard(), GradeThresholds, intervalLabel(), isDue(), newCard() (+25 more)

### Community 4 - "Board Vision & Geometry"
Cohesion: 0.11
Nodes (31): genBlindfold(), pieceAt(), SQ, answers, q, aligned(), fromXY(), genRelation() (+23 more)

### Community 5 - "Stockfish Engine Client"
Cohesion: 0.11
Nodes (18): defaultWorkerFactory(), EngineClient, EvalResult, GoOptions, Listener, t, engineWorkerUrl(), forceLiteFallback (+10 more)

### Community 6 - "Board & Training UI Hub"
Cohesion: 0.11
Nodes (22): chessground/api, ../calc/calc, ../concepts/concepts, ../game/ChessGame, ../guess/games, ../guess/guess, ../metacog/metacog, ../repertoire/repertoire (+14 more)

### Community 7 - "Endgame Tablebase (Syzygy)"
Cohesion: 0.1
Nodes (21): loadConcepts(), bestMove(), FetchFn, NetworkNotAllowedError, normalize(), pieceCount(), RawTablebase, TablebaseClient (+13 more)

### Community 8 - "Clock & Time Controls"
Cohesion: 0.1
Nodes (24): Category, categoryFor(), fmtClock(), insufficientMatingMaterial(), bullet, expected, ids, labels (+16 more)

### Community 9 - "Metacognition Tagging"
Cohesion: 0.1
Nodes (24): buildByConfidence(), buildSelfTags(), buildSentence(), Calibration, CalibrationReadout, Confidence, ConfidenceRow, CONFIDENCES (+16 more)

### Community 10 - "Positional Explanation"
Cohesion: 0.12
Nodes (18): explainPly(), Explanation, MOTIF_EXPLANATION, PHASE_PHRASE, SEVERITY_PHRASE, e, high, low (+10 more)

### Community 11 - "Tactical Motif Detection"
Cohesion: 0.17
Nodes (21): BISHOP_DIRS, captureTargetsFrom(), detectGeometric(), detectMotif(), fileRank(), findKing(), isBackRankMate(), isDefendedBy() (+13 more)

### Community 12 - "Concept Cards"
Cohesion: 0.11
Nodes (19): CARD_PRECEDENCE, cardForMotif(), cardForThemes(), ConceptCard, ConceptExample, familyKey(), Fetcher, MOTIF_ALIASES (+11 more)

### Community 13 - "Adaptive Human Opponent"
Cohesion: 0.15
Nodes (14): AdaptiveOpponent, clampElo(), GameOutcome, initOpponentState(), OpponentState, recordGame(), rollingWinRate(), pattern (+6 more)

### Community 14 - "Analysis Run & Puzzle Gen"
Cohesion: 0.14
Nodes (16): engineEvaluator(), engineLineEvaluator(), GenerateOptions, generatePuzzlesFromAnalysis(), LineEvaluator, moverCp(), a, lines (+8 more)

### Community 15 - "Weakness Profiling"
Cohesion: 0.16
Nodes (17): acplToScore(), buildWeaknessProfile(), clamp(), DrillTarget, expectedAcpl(), phaseAcpl(), resilienceScore(), TACTICS_THEMES (+9 more)

### Community 16 - "Dashboard & Insights UI"
Cohesion: 0.13
Nodes (14): ../analysis/efficacy, ../analysis/fingerprint, ../analysis/session, ../analysis/studyPlan, ../analysis/weakness, ../coach/program, advance(), nowMs (+6 more)

### Community 17 - "Rating Calibration"
Cohesion: 0.13
Nodes (15): acplToElo(), DeclarativeAnswers, LadderOpts, priorFromDeclarative(), seedGameRating(), down, ladder, loss (+7 more)

### Community 18 - "Critical Moments Analysis"
Cohesion: 0.14
Nodes (14): CriticalMoment, criticalMoments(), CriticalOptions, CurvePoint, c, m, PHASE, PLIES (+6 more)

### Community 19 - "Tactical Trainer"
Cohesion: 0.14
Nodes (11): MatchResult, Rating, sameMove(), SolveState, TacticalTrainer, base, failed, matePuzzle (+3 more)

### Community 21 - "Study Plan & Fingerprint"
Cohesion: 0.18
Nodes (12): Leak, TrendPoint, weaknessTrend(), activityForLeak(), buildStudyPlan(), PlanItem, StudyPlanOpts, drills (+4 more)

### Community 22 - "Coach UI Ladders"
Cohesion: 0.15
Nodes (15): ../coach/diagnostic, ../coach/types, [], display, feedback, fen, finishThemeLadder(), game (+7 more)

### Community 23 - "Glicko-2 Rating"
Cohesion: 0.21
Nodes (15): clampRd(), expectedScore(), fromMu(), fromPhi(), g(), after, loss, p (+7 more)

### Community 24 - "Batch Analyzer & Win Prob"
Cohesion: 0.23
Nodes (13): analyzeGame(), AnalyzeOptions, emptyPhaseStat(), PositionEval, classify(), cpLoss(), DEFAULT_THRESHOLDS, GaffeThresholds (+5 more)

### Community 25 - "App Shell & Routing"
Cohesion: 0.24
Nodes (8): ../analysis/comeback, ../analysis/scenarios, ../analysis/winProb, ../engine/AdaptiveOpponent, ../state/app.svelte, ../store/playerModel, target, ./AnalysisBoard.svelte

### Community 26 - "Session Builder"
Cohesion: 0.14
Nodes (13): buildSession(), SessionPlan, SessionStep, SessionStepKind, tacticsRouting(), kinds, plan, session (+5 more)

### Community 27 - "Efficacy Test Fixtures"
Cohesion: 0.16
Nodes (14): a, analyses, base, clean(), fork(), game(), mg(), oppForks (+6 more)

### Community 28 - "Fingerprint Test Fixtures"
Cohesion: 0.13
Nodes (11): confident, fallback, g, games, keys, { leaks }, many, p (+3 more)

### Community 29 - "Scenario Sparring"
Cohesion: 0.18
Nodes (10): buildFingerprint(), IMBALANCE_LIBRARY, Scenario, scenariosFromWeakness(), c, g, PHASE, scen (+2 more)

### Community 30 - "Opening Book"
Cohesion: 0.19
Nodes (12): Dimension, DIMENSION_LABEL, nextBookMove(), OPENING_BOOK, OpeningEntry, selectOpening(), steeringNote(), c (+4 more)

### Community 31 - "Analysis Result UI"
Cohesion: 0.19
Nodes (10): ../analysis/criticalMomentDrill, ../analysis/criticalMomentFallback, ../analysis/criticalMoments, ../analysis/explain, ../analysis/pgn, ../analysis/runAnalysis, ../analysis/types, ../opening/eco (+2 more)

### Community 32 - "Play & Onboarding UI"
Cohesion: 0.18
Nodes (12): ../calibration/Calibration, ../clock/categories, ../clock/Clock, ../game/color, ../opening/openingBook, ../rating/glicko2, ../rating/pools, ../variant/chess960 (+4 more)

### Community 33 - "Lapse Scheduling"
Cohesion: 0.21
Nodes (11): AttemptLike, buildLapseSet(), failCountByPuzzle(), interleave(), isLeech(), attempts, failAttempts, ids (+3 more)

### Community 34 - "Guess-the-Move"
Cohesion: 0.27
Nodes (4): GuessGame, GuessResult, sameMove(), uciToMove()

### Community 35 - "Puzzle Repository"
Cohesion: 0.21
Nodes (8): phaseOf(), Puzzle, Fetcher, PuzzleQuery, a, b, p, repo

### Community 36 - "PGN Parsing"
Cohesion: 0.26
Nodes (8): PositionEvaluator, evaluator, game, clockToMs(), parseIncrement(), parsePgn(), g, whiteSecond

### Community 37 - "Chess960 Castling Tests"
Cohesion: 0.18
Nodes (11): after, back, castleFor(), color, g, g2, game(), ILLEGAL (+3 more)

### Community 38 - "ChessGame Types & 960"
Cohesion: 0.17
Nodes (11): Chess960CastleFiles, ChessGameOpts, Dests, Side960Rights, TerminalState, dests, g, t (+3 more)

### Community 39 - "ECO Opening Codes"
Cohesion: 0.29
Nodes (9): describeOpening(), EcoEntry, firstOutOfBook(), loadEco(), nameOpening(), OpeningName, najdorf, r (+1 more)

### Community 40 - "Vision Stats"
Cohesion: 0.22
Nodes (9): recordDrill(), input, out, s, s1, s2, VisionDrillKey, VisionDrillStat (+1 more)

### Community 41 - "Master Games Data"
Cohesion: 0.22
Nodes (6): MASTER_GAMES, MasterGame, c, exp, g, shown

### Community 42 - "Comeback Detection"
Cohesion: 0.24
Nodes (6): ComebackPosition, comebackPositions(), g, PHASE, pos, GameAnalysis

### Community 43 - "Chess960 Position Tests"
Cohesion: 0.22
Nodes (9): c, checkLegal(), isDark(), king, p, { readFileSync }, { resolve }, rooks (+1 more)

### Community 44 - "Tactics Vision Scan"
Cohesion: 0.39
Nodes (6): allCaptures(), allChecks(), hangingPieces(), VAL, verbose(), VMove

### Community 45 - "Motif Efficacy"
Cohesion: 0.33
Nodes (8): aggregate(), EfficacyReadout, EfficacyWindow, isFlagged(), labelFor(), motifEfficacy(), ZERO, leakKey()

### Community 47 - "Chess960 Position Gen"
Cohesion: 0.42
Nodes (8): backRankForId(), castleFromBackRank(), Chess960Position, chess960PositionById(), emptyIndices(), KNIGHT_PLACEMENT, placeNth(), startFenFor()

### Community 48 - "Vision Training UI"
Cohesion: 0.25
Nodes (7): ../vision/blindfold, ../vision/geometry, ../vision/grading, ../vision/tacticsVision, ../vision/vision, ../vision/visionStats, ../vision/weakSquares

### Community 49 - "Calculation Drill"
Cohesion: 0.43
Nodes (5): firstWrongUserMove(), formatSanLine(), gradeCalcLine(), r, SOL

### Community 51 - "Concept Card Board Tests"
Cohesion: 0.33
Nodes (4): board, conceptCard, { readFileSync }, { resolve }

### Community 54 - "Board Turn-Color Test"
Cohesion: 0.4
Nodes (3): board, { readFileSync }, { resolve }

### Community 55 - "Endgames UI"
Cohesion: 0.5
Nodes (3): ../endgame/drills, ../endgame/syzygy, ../endgame/tablebaseCache

## Knowledge Gaps
- **358 isolated node(s):** `target`, `game`, `evaluator`, `PositionEval`, `AnalyzeOptions` (+353 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `../store/db` connect `Data Store & Persistence` to `Play & Onboarding UI`, `Spaced Repetition (FSRS)`, `Puzzle Repository`, `Clock & Time Controls`, `Comeback Detection`, `Adaptive Human Opponent`, `Analysis Run & Puzzle Gen`, `Critical Moments Analysis`, `Tactical Trainer`, `Glicko-2 Rating`, `Analysis Result UI`?**
  _High betweenness centrality (0.310) - this node is a cross-community bridge._
- **Why does `../analysis/types` connect `Critical Moments Analysis` to `Data Store & Persistence`, `Critical Moment Drills`, `Guess-the-Move`, `PGN Parsing`, `Comeback Detection`, `Positional Explanation`, `Tactical Motif Detection`, `Motif Efficacy`, `Analysis Run & Puzzle Gen`, `Weakness Profiling`, `Dashboard & Insights UI`, `Study Plan & Fingerprint`, `Batch Analyzer & Win Prob`, `Efficacy Test Fixtures`, `Fingerprint Test Fixtures`, `Scenario Sparring`?**
  _High betweenness centrality (0.188) - this node is a cross-community bridge._
- **Why does `GameAnalysis` connect `Comeback Detection` to `Data Store & Persistence`, `Critical Moment Drills`, `Motif Efficacy`, `Analysis Run & Puzzle Gen`, `Weakness Profiling`, `Critical Moments Analysis`, `Study Plan & Fingerprint`, `Batch Analyzer & Win Prob`, `Efficacy Test Fixtures`, `Fingerprint Test Fixtures`, `Scenario Sparring`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **What connects `target`, `game`, `evaluator` to the rest of the system?**
  _358 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Store & Persistence` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Critical Moment Drills` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `Coach Diagnostic & Program` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._