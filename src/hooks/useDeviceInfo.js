import { useEffect, useState } from "react"

export function useDeviceInfo() {
    const [deviceInfo, setDeviceInfo] = useState({uuid: null, token: null, ostype: null, modelname: null, detailmodelname: null});

    useEffect(() => {
        window.receiveDeviceInfo = (uuid, token, ostype, modelname, detailmodelname) => {
            console.log("기기 정보 수신:", uuid, token, ostype, modelname, detailmodelname);
            setDeviceInfo({ uuid, token, ostype, modelname, detailmodelname });
        };

        if(window.AndroidBridge) {
            window.AndroidBridge.deviceInfoReq();
        } else if(window.webkit?.messageHandlers?.nativeBridge) {
            window.webkit.messageHandlers.nativeBridge.postMessage("deviceInfoReq");
        }

        return () => {
            delete window.receiveDeviceInfo;
        };
    }, []);

    return deviceInfo;
}