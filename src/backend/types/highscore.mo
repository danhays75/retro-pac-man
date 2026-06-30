module {
  /// A persisted high-score entry for the Pac-Man arcade game.
  public type HighScore = {
    var score : Nat;
    var playerName : Text;
    var updatedAt : Int;
  };
};
