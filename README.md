# Wavelength Game

Online multiplayer turn-based party game. The point is to guess what other players think or make it difficult (but not impossible) for others to guess what you think.

Access the game here
https://maciek50322.github.io/wavelength-game/

## Creating / joining a game

This game requires internet connection.

You need 1 player to be a host. Click **Host** to become the host and create the game. Remember that you need a name. The host will hold the game together - if the host loses his connection or decides to leave, the game will end.

Host should invite other players by sharing **Game Id** or his link. Other players after filling in their names and game id can click "Join". Players can join at any time. If player leaves their scores are lost.

## Gameplay

You need at least 2 players in lobby to start the game, but 3 and more is recommended.

- Once everyone click **Ready** the game starts. Host has ability to start the game without everyone being ready.
- One player is selected as **Clue Master**, everyone else will wait during this time. The clue master has to come up with topic / clue and 2 options (or draw it randomly), then select on scale between these options what they think regarding the topic / clue. Host has ability to end this round.
- In next phase the clue master waits and everyone else tries to guess what clue master selected on the scale. The closer to the answer, the more points for guesser. The round is finished once everyone submitted their guesses. Host has ability to finish round without all guesses submitted.
- The answers and scores are displayed until everyone is ready for next round. In the next round the next person becomes clue master.

## Scoring system

### Guessers

Players get points based on proximity to the clue master's answer, with exponential decline away from answer - player gets 1 full point if his guess is 25% away from answer. Maximum points for guessing exact answer are calculated based on scale step (minimum distance between adjacent guessing options in %), default 5%.

```
MaxPoints = 100% / Step
Proximity = |Guess - Answer|
GuesserPoints = MaxPoints^(1 - Proximity / 25%)
```

Guessers need to be as close to answer as possible for most points.

### Clue master

For 2 players (1 guesser) clue master gets points that guesser didn't score.

```
MaxPoints = 100% / Step
ClueMasterPoints = MaxPoints - GuesserGainedPoints
```

For 3+ players clue master gets points based on group divide. Guessers are split in 2 equally sized groups, those with most points and least points - with odd number of guessers the middle one is excluded. Clue master gets average of group with most points substracted by average of group with least points.

```
MostPointsGroup = (GuesserGainedPoints + ...) / GroupSize
LeastPointsGroup = (GuesserGainedPoints + ...) / GroupSize
ClueMasterPoints = MostPointsGroup - LeastPointsGroup
```

Clue master needs to come up with clue hard, but not too hard for half of room to guess correctly and other half to guess incorrectly to get most points.
