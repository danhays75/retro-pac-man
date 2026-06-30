import MixinViews "mo:caffeineai-data-viewer/MixinViews";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";

import Types "types/highscore";
import HighScoreLib "lib/highscore";
import HighScoreApi "mixins/highscore-api";

actor {
  include MixinViews();

  let accessControlState : AccessControl.AccessControlState;
  include MixinAuthorization(accessControlState, null);

  let highScore : Types.HighScore;
  include HighScoreApi(highScore);
};
