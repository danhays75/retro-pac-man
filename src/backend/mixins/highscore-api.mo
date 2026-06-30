import Time "mo:core/Time";
import HighScoreLib "../lib/highscore";
import Types "../types/highscore";

mixin (highScore : Types.HighScore) {
  /// Retrieve the current persisted high score.
  public query func getHighScore() : async Nat {
    highScore.getScore();
  };

  /// Retrieve the current persisted high score together with the player
  /// name and the timestamp of the last update.
  public query func getHighScoreRecord() : async {
    score : Nat;
    playerName : Text;
    updatedAt : Int;
  } {
    {
      score = highScore.getScore();
      playerName = highScore.getPlayerName();
      updatedAt = highScore.getUpdatedAt();
    };
  };

  /// Submit a new score. The score is persisted only when it is strictly
  /// greater than the current high score. Returns the (possibly updated)
  /// current high score.
  public shared ({ caller }) func submitScore(score : Nat, playerName : Text) : async Nat {
    ignore caller;
    let _ = highScore.applyIfHigher(score, playerName, Time.now());
    highScore.getScore();
  };
};
