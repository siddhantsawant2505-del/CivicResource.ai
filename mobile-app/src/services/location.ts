import * as Location from 'expo-location';

export interface DeviceLocation {
  lat: number;
  lng: number;
  address: string;
}

export const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
  const reverse = await Location.reverseGeocodeAsync({
    latitude: lat,
    longitude: lng,
  });

  const first = reverse[0];
  return first
    ? [first.name, first.street, first.city, first.region].filter(Boolean).join(', ')
    : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

export const getCurrentLocation = async (): Promise<DeviceLocation | null> => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    return null;
  }

  const coords = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  const address = await getAddressFromCoordinates(coords.coords.latitude, coords.coords.longitude);

  return {
    lat: coords.coords.latitude,
    lng: coords.coords.longitude,
    address,
  };
};
