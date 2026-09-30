import { useCallback, useEffect, useState } from "react";
import { CITIES } from "@/lib/constants";

const KEY = "uzhavan_location_v2";
const DEFAULT_CITY = { name: "Coimbatore", lat: 11.0168, lng: 76.9558 };

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null") || DEFAULT_CITY;
  } catch {
    return DEFAULT_CITY;
  }
};


export function useLocationPref() {
  const [place, setPlace] = useState(read);

  const choose = useCallback((next) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    setPlace(next);
    window.dispatchEvent(new CustomEvent("uzhavan:locationChange", { detail: next }));
  }, []);

  useEffect(() => {
    const onLocationChange = (e) => {
      if (e.detail) setPlace(e.detail);
      else setPlace(read());
    };
    window.addEventListener("uzhavan:locationChange", onLocationChange);
    window.addEventListener("storage", onLocationChange);
    return () => {
      window.removeEventListener("uzhavan:locationChange", onLocationChange);
      window.removeEventListener("storage", onLocationChange);
    };
  }, []);

  const useDevice = useCallback(() => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Location is not supported on this device."));
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { const next = { name: "My location", lat: coords.latitude, lng: coords.longitude }; choose(next); resolve(next); },
      () => reject(new Error("Could not read your location. Please pick a city.")),
      { timeout: 8000 }
    );
  }), [choose]);

  return { place, choose, useDevice, cities: CITIES };
}

