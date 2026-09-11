const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const jwt = require("jsonwebtoken");

const appleMapKitPrivateKey = defineSecret("APPLE_MAPKIT_PRIVATE_KEY");

const TEAM_ID = "9KH64W7EHZ";
const KEY_ID = "YOUR_KEY_ID"; // .p8 발급 시 받은 Key ID (Maps ID와 다름)
const MAPS_ID = "9KH64W7EHZ.maps.com.najak.KidsFullCare"; // origin(iss/sub) 확인용

exports.getMapKitToken = onCall(
  { secrets: [appleMapKitPrivateKey] },
  async (request) => {
    try {
      const privateKey = appleMapKitPrivateKey.value();

      const token = jwt.sign({}, privateKey, {
        algorithm: "ES256",
        expiresIn: "30m",
        issuer: TEAM_ID,
        header: {
          alg: "ES256",
          kid: KEY_ID,
          typ: "JWT",
        },
      });

      return { token };
    } catch (err) {
      console.error("MapKit 토큰 생성 실패:", err);
      throw new HttpsError("internal", "토큰 생성에 실패했습니다.");
    }
  }
);