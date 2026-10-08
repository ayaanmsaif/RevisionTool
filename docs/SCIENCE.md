# The science behind RevisionTool

RevisionTool is built around the learning techniques with the strongest evidence. This page explains each design decision and the research behind it, so you know why the app asks you things the way it does.

## 1. Every interaction is a question (retrieval practice)

Pulling an answer out of memory strengthens it far more than reading it again. This is the *testing effect*, one of the most replicated findings in learning science. Students who practise retrieval remember much more a week later than students who reread, even though rereading feels more productive at the time.

**In the app:** there is no "read through the cards" mode. Every card is asked as a question, and the answer is shown only after you commit to one.

- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science, 17*(3), 249-255.
- Adesope, O. O., Trevisan, D. A., & Sundararajan, N. (2017). Rethinking the use of tests: A meta-analysis of practice testing. *Review of Educational Research, 87*(3), 659-701.
- Yang, C., Luo, L., Vadillo, M. A., Yu, R., & Shanks, D. R. (2021). Testing (quizzing) boosts classroom learning: A systematic and meta-analytic review. *Psychological Bulletin, 147*(4), 399-435.

## 2. Reviews come back just before you would forget (spacing, FSRS)

Spreading practice over days beats cramming the same amount of time into one session, and the best gap grows as a memory gets stronger. RevisionTool schedules every card with **FSRS-6** (Free Spaced Repetition Scheduler), an open-source model that estimates each card's *stability* (how long the memory lasts) and *difficulty*, then predicts the chance you still remember it. In public benchmarks on millions of real reviews, FSRS predicts forgetting more accurately than the SM-2 algorithm that older flashcard apps use, which means fewer wasted reviews for the same retention.

**In the app:** each card is due when your predicted recall drops to your *desired retention* (90% by default, adjustable from 80% to 97% in Settings). Overdue reviews are ordered with the most at-risk cards first. The Stats page shows your *true retention* (how often you actually remembered reviewed cards) next to your target.

- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin, 132*(3), 354-380.
- Cepeda, N. J., Vul, E., Rohrer, D., Wixted, J. T., & Pashler, H. (2008). Spacing effects in learning: A temporal ridgeline of optimal retention. *Psychological Science, 19*(11), 1095-1102.
- Ye, J., Su, J., & Cao, Y. (2022). A stochastic shortest path algorithm for optimizing spaced repetition scheduling. *Proceedings of the 28th ACM SIGKDD Conference on Knowledge Discovery and Data Mining (KDD '22)*.
- Open Spaced Repetition. *SRS benchmark* and *ts-fsrs*. github.com/open-spaced-repetition

## 3. New cards start with a guess (pretesting)

Trying to answer a question *before* you have learned the answer, even when you get it wrong, makes the answer stick better once you see it. The failed attempt primes you to notice and encode the right answer.

**In the app:** the first time you meet a card it appears as a "guess first" multiple-choice question. A wrong guess is met with "Good guess. Now you know." rather than a penalty.

- Richland, L. E., Kornell, N., & Kao, L. S. (2009). The pretesting effect: Do unsuccessful retrieval attempts enhance learning? *Journal of Experimental Psychology: Applied, 15*(3), 243-257.
- Pan, S. C., & Carpenter, S. K. (2023). Prequestioning and pretesting effects: A review of empirical research, theoretical perspectives, and implications for educational practice. *Educational Psychology Review, 35*, 97.

## 4. Questions get harder as you improve (desirable difficulties)

Retrieval that takes effort but still succeeds produces more durable learning than easy retrieval. Recognising an answer among options is easier than recalling it from nothing, so the best practice moves from recognition towards free recall as a memory strengthens.

**In the app:** each card climbs a *format ladder*:

| Card stage | Formats |
|---|---|
| New | Multiple choice (pretest) |
| Just missed or still learning | Multiple choice, true or false, matching |
| Learning, second step | Fill the gap, type it |
| Review, memory under a week | Fill the gap, type it |
| Review, strong memory | Type it, recall (flip) |

Cards in the review stage are never asked as multiple choice, so an easy guess can never stretch an interval. Formats also rotate so the same card is not asked the same way twice in a row.

- Bjork, R. A. (1994). Memory and metamemory considerations in the training of human beings. In J. Metcalfe & A. Shimamura (Eds.), *Metacognition: Knowing about knowing* (pp. 185-205). MIT Press.
- Pyc, M. A., & Rawson, K. A. (2009). Testing the retrieval effort hypothesis: Does greater difficulty correctly recalling information lead to higher levels of memory? *Journal of Memory and Language, 60*(4), 437-447.
- Little, J. L., Bjork, E. L., Bjork, R. A., & Angello, G. (2012). Multiple-choice tests exonerated, at least of some charges: Fostering test-induced learning and avoiding test-induced forgetting. *Psychological Science, 23*(11), 1337-1344. (Plausible wrong options make multiple choice a genuine retrieval task, which is why the AI prompt asks for them.)

## 5. Missed cards come back until you get them (successive relearning)

Retrieving information to a criterion (answering correctly at least once) in one session, then relearning it in later sessions spaced days apart, is one of the most effective combinations ever tested in real courses.

**In the app:** a card you miss returns three to five questions later in the same lesson, until you get it right (up to three tries, after which FSRS brings it back very soon). It is then spaced out across the following days.

- Rawson, K. A., Dunlosky, J., & Sciartelli, S. M. (2013). The power of successive relearning: Improving performance on course exams and long-term retention. *Educational Psychology Review, 25*(4), 523-548.

## 6. Topics are mixed (interleaving)

Mixing different topics in one session, rather than blocking one topic at a time, helps you learn *which* idea applies to *which* problem. The benefit is strongest when the topics are easy to confuse.

**In the app:** daily review mixes all your decks and avoids asking two cards from the same topic back to back. Topic practice is available for when one area needs focused work.

- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science, 35*(6), 481-498.
- Brunmair, M., & Richter, T. (2019). Similarity matters: A meta-analysis of interleaved learning and its moderators. *Psychological Bulletin, 145*(11), 1029-1052.

## 7. Immediate feedback with an explanation (feedback and elaboration)

Feedback after a test, especially showing the correct answer after an error, is what turns mistakes into learning. Errors made with confidence are corrected especially well once feedback arrives. Explaining *why* an answer is right links it to what you already know.

**In the app:** every answer is followed by the correct answer and a short explanation. Mistakes are not punished by default; the optional Hardcore mode exists for people who enjoy the pressure, but it is off unless you turn it on.

- Butler, A. C., & Roediger, H. L. (2008). Feedback enhances the positive effects and reduces the negative effects of multiple-choice testing. *Memory & Cognition, 36*(3), 604-616.
- Butterfield, B., & Metcalfe, J. (2001). Errors committed with high confidence are hypercorrected. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 27*(6), 1491-1494.
- Metcalfe, J. (2017). Learning from errors. *Annual Review of Psychology, 68*, 465-489.
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., & Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest, 14*(1), 4-58.

## 8. Write it all down (free recall, blurting)

For long answers, writing everything you can remember and then checking it against the key points is a powerful form of retrieval practice, and it trains the extended answers that essay subjects demand.

**In the app:** essay cards are asked in *Blurt it out* mode. You write freely, the app pre-ticks the key points it can spot, you confirm, and the share of points recalled sets the schedule.

- Karpicke, J. D., & Blunt, J. R. (2011). Retrieval practice produces more learning than elaborative studying with concept mapping. *Science, 331*(6018), 772-775.

## 9. The app marks your answers, not you (metacognition)

People are poor judges of their own learning and tend to rate themselves too generously, especially straight after studying. Objective checking gives the scheduler better information.

**In the app:** answers are graded automatically wherever possible (typos, accents, numbers and units are handled sensibly), and response time refines the rating. You only rate yourself on flip and blurt cards, and you can override a typed answer the checker got wrong.

- Koriat, A., & Bjork, R. A. (2005). Illusions of competence in monitoring one's knowledge during study. *Journal of Experimental Psychology: Learning, Memory, and Cognition, 31*(2), 187-194.

## 10. Good cards (minimum information principle)

Small, precise cards are learned faster and forgotten less than big ones. Lists and compound facts are hard to remember as a single item.

**In the app:** the AI prompt asks for one idea per card, short answers, a separate steps card for sequences and an essay card for multi-point answers. Cards you keep forgetting ("leeches") are flagged, and the app writes a prompt asking your AI to split them up and add memory hooks.

- Wozniak, P. (1999). *Effective learning: Twenty rules of formulating knowledge*. SuperMemo.

## 11. Motivation (gamification)

Game elements such as points, streaks, levels and badges have small-to-medium positive effects on learning outcomes on average, mostly by keeping people coming back. Coming back is what makes spacing work.

**In the app:** XP (more for harder formats), combos with rising sounds, a daily goal that keeps a streak alive (with streak freezes for the odd missed day), levels, achievements, and a weekly comparison against your own past. Games (Match and Blitz) are pure fun and never change your schedule.

- Sailer, M., & Homner, L. (2020). The gamification of learning: A meta-analysis. *Educational Psychology Review, 32*, 77-112.
