// src/components/SchoolAppleMap.jsx
import { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const getMapKitTokenFn = httpsCallable(functions, "getMapKitToken");

let mapkitLoadPromise = null;

function loadMapKitScript() {
  if (window.mapkit) return Promise.resolve();
  if (mapkitLoadPromise) return mapkitLoadPromise;

  mapkitLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = resolve;
    script.onerror = () => reject(new Error("MapKit 스크립트 로드 실패"));
    document.head.appendChild(script);
  });

  return mapkitLoadPromise;
}

function initMapKitOnce() {
  if (window.mapkit && window.mapkit._isInitialized) return;
  window.mapkit.init({
    authorizationCallback: async (done) => {
      try {
        const result = await getMapKitTokenFn();
        done(result.data.token);
      } catch (err) {
        console.error("MapKit 토큰 발급 실패:", err);
      }
    },
  });
  window.mapkit._isInitialized = true;
}

function SchoolAppleMap({ address, schoolName }) {
  const mapDivRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!address) return;
      setStatus("loading");

      try {
        await loadMapKitScript();
        if (cancelled) return;
        initMapKitOnce();

        // 지도 인스턴스는 한 번만 생성하고 재사용
        if (!mapInstanceRef.current && mapDivRef.current) {
          mapInstanceRef.current = new window.mapkit.Map(mapDivRef.current, {
            showsCompass: window.mapkit.FeatureVisibility.Hidden,
            showsZoomControl: true,
            showsMapTypeControl: false,
          });
        }

        const geocoder = new window.mapkit.Geocoder({ language: "ko-KR" });
        geocoder.lookup(address, (error, data) => {
          if (cancelled) return;
          if (error || !data?.results?.length) {
            setStatus("notfound");
            return;
          }

          const { coordinate } = data.results[0];
          const map = mapInstanceRef.current;

          map.region = new window.mapkit.CoordinateRegion(
            coordinate,
            new window.mapkit.CoordinateSpan(0.01, 0.01)
          );

          map.removeAnnotations(map.annotations);
          const annotation = new window.mapkit.MarkerAnnotation(coordinate, {
            title: schoolName || "학교",
            color: "#FF3B30",
          });
          map.addAnnotation(annotation);

          setStatus("ready");
        });
      } catch (err) {
        console.error("Apple Map 표시 실패:", err);
        if (!cancelled) setStatus("error");
      }
    }

    setup();

    return () => {
      cancelled = true;
    };
  }, [address, schoolName]);

  return (
    <div className="school-map-wrap">
      <div ref={mapDivRef} className="school-map-canvas" />
      {status === "loading" && <p className="school-map-status">지도를 불러오는 중...</p>}
      {status === "notfound" && <p className="school-map-status">주소 위치를 찾을 수 없어요.</p>}
      {status === "error" && <p className="school-map-status">지도를 불러오지 못했어요.</p>}
    </div>
  );
}

export default SchoolAppleMap;