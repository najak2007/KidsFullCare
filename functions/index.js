/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

initializeApp();
 
exports.cleanupExpiredLinkCodes = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "Asia/Seoul",
  },
  async () => {
    const db = getFirestore();
    const now = Timestamp.now();
 
    const expiredSnapshot = await db
      .collection("linkCodes")
      .where("expiresAt", "<=", now)
      .get();
 
    if (expiredSnapshot.empty) {
      return;
    }
 
    // 한 번에 지울 문서가 많을 수 있으니 배치로 처리합니다 (최대 500개/배치).
    const batch = db.batch();
    expiredSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
 
    console.log(`만료된 linkCodes ${expiredSnapshot.size}개 삭제 완료`);
  }
);

exports.searchSchool = require("./searchSchool").searchSchool;
exports.getMapKitToken = require("./mapkitToken").getMapKitToken;