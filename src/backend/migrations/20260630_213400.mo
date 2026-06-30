import Map "mo:core/Map";
import Principal "mo:core/Principal";

module {
  type OldActor = {};

  type UserRole = {
    #admin;
    #user;
    #guest;
  };

  type AccessControlState = {
    var adminAssigned : Bool;
    userRoles : Map.Map<Principal, UserRole>;
  };

  type HighScore = {
    var score : Nat;
    var playerName : Text;
    var updatedAt : Int;
  };

  type NewActor = {
    accessControlState : AccessControlState;
    highScore : HighScore;
  };

  public func migration(_old : OldActor) : NewActor {
    {
      accessControlState = {
        var adminAssigned = false;
        userRoles = Map.empty<Principal, UserRole>();
      };
      highScore = {
        var score = 0;
        var playerName = "";
        var updatedAt = 0;
      };
    };
  };
};
