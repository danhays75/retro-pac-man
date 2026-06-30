import Types "../types/highscore";

module {
  public type HighScore = Types.HighScore;

  /// Create a new high-score record with the given score and player name.
  public func new(score : Nat, playerName : Text, updatedAt : Int) : HighScore {
    {
      var score;
      var playerName;
      var updatedAt;
    };
  };

  /// Return the current score value of a high-score record.
  public func getScore(self : HighScore) : Nat {
    self.score;
  };

  /// Return the player name of a high-score record.
  public func getPlayerName(self : HighScore) : Text {
    self.playerName;
  };

  /// Return the timestamp (nanoseconds) of the last update.
  public func getUpdatedAt(self : HighScore) : Int {
    self.updatedAt;
  };

  /// Apply a new score to the record if it is strictly greater than the
  /// current score. Returns true when the record was updated.
  public func applyIfHigher(self : HighScore, score : Nat, playerName : Text, updatedAt : Int) : Bool {
    if (score > self.score) {
      self.score := score;
      self.playerName := playerName;
      self.updatedAt := updatedAt;
      true;
    } else {
      false;
    };
  };
};
