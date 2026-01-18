const DEFAULT_LOCATION = { lat: 40.73061, lng: -73.935242 };
const DEFAULT_RADIUS_METERS = 1500;
const MAP_ZOOM = 14;

let map;
let service;
let markers = [];
let infoWindow;

function initMap() {
  const mapElement = document.getElementById("map");
  const errorElement = document.getElementById("map-error");
  const locateButton = document.getElementById("locate");
  const searchAreaButton = document.getElementById("search-area");

  map = new google.maps.Map(mapElement, {
    center: DEFAULT_LOCATION,
    zoom: MAP_ZOOM,
    mapId: "DEMO_MAP_ID",
  });

  infoWindow = new google.maps.InfoWindow();
  service = new google.maps.places.PlacesService(map);

  locateButton.addEventListener("click", () => {
    locateButton.disabled = true;
    searchAreaButton.disabled = true;
    locateUserLocation()
      .then((location) => {
        errorElement.hidden = true;
        updateMap(location, "Your location");
        return fetchNearbyBusinesses(location);
      })
      .catch((error) => {
        errorElement.hidden = false;
        errorElement.textContent = error.message;
        updateMap(DEFAULT_LOCATION, "Default location");
        return fetchNearbyBusinesses(DEFAULT_LOCATION);
      })
      .finally(() => {
        locateButton.disabled = false;
        searchAreaButton.disabled = false;
      });
  });

  searchAreaButton.addEventListener("click", () => {
    const center = map.getCenter();
    if (!center) {
      return;
    }

    const location = { lat: center.lat(), lng: center.lng() };
    const radius = getSearchRadiusFromBounds();

    searchAreaButton.disabled = true;
    locateButton.disabled = true;
    errorElement.hidden = true;

    updateMap(location, "Search area");
    fetchNearbyBusinesses(location, radius).finally(() => {
      searchAreaButton.disabled = false;
      locateButton.disabled = false;
    });
  });

  updateMap(DEFAULT_LOCATION, "Default location");
  fetchNearbyBusinesses(DEFAULT_LOCATION);
}

function locateUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        reject(
          new Error(
            "We couldn't access your location. Showing businesses near the default location instead."
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

function updateMap(location, label) {
  map.setCenter(location);
  clearMarkers();

  const marker = new google.maps.Marker({
    position: location,
    map,
    label: {
      text: label,
      className: "marker-label",
    },
  });

  markers.push(marker);
}

function fetchNearbyBusinesses(location, radius = DEFAULT_RADIUS_METERS) {
  return new Promise((resolve) => {
    const request = {
      location,
      radius,
      type: "store",
      openNow: false,
    };

    service.nearbySearch(request, (results, status) => {
      if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
        renderResults([]);
        resolve();
        return;
      }

      const sortedResults = results
        .slice(0, 10)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));

      const markersByPlaceId = renderMarkers(sortedResults);
      renderResults(sortedResults, markersByPlaceId);
      resolve();
    });
  });
}

function renderResults(results, markersByPlaceId) {
  const list = document.getElementById("results");
  list.innerHTML = "";

  if (results.length === 0) {
    const empty = document.createElement("li");
    empty.className = "result-empty";
    empty.textContent = "No businesses found nearby.";
    list.appendChild(empty);
    return;
  }

  results.forEach((place, index) => {
    const item = document.createElement("li");
    item.className = "result-item";

    // Get marker by place_id if available, otherwise by location coordinates
    let marker = null;
    if (place.place_id) {
      marker = markersByPlaceId.get(place.place_id);
    } else if (place.geometry?.location) {
      const key = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      marker = markersByPlaceId.get(key);
    }

    const header = document.createElement("div");
    header.className = "result-header";

    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${place.name}`;
    name.className = "result-name";

    const rating = document.createElement("span");
    rating.textContent = place.rating
      ? `⭐ ${place.rating.toFixed(1)}`
      : "No rating";
    rating.className = "result-rating";

    header.append(name, rating);

    const address = document.createElement("p");
    address.textContent = place.vicinity || "Address not available";
    address.className = "result-address";

    item.append(header, address);
    item.addEventListener("click", () => {
      if (marker) {
        map.panTo(marker.getPosition());
        map.setZoom(MAP_ZOOM + 2);
        infoWindow.setContent(
          `<div class="info-window"><strong>${place.name}</strong><br/>${place.vicinity || ""}</div>`
        );
        infoWindow.open(map, marker);
        return;
      }

      if (place.geometry?.location) {
        map.panTo(place.geometry.location);
        map.setZoom(MAP_ZOOM + 2);
      }
    });

    list.appendChild(item);
  });
}

function renderMarkers(results) {
  const markersByPlaceId = new Map();

  results.forEach((place) => {
    if (!place.geometry?.location) {
      return;
    }

    const marker = new google.maps.Marker({
      position: place.geometry.location,
      map,
      title: place.name,
    });

    marker.addListener("click", () => {
      infoWindow.setContent(
        `<div class="info-window"><strong>${place.name}</strong><br/>${place.vicinity || ""}</div>`
      );
      infoWindow.open(map, marker);
    });

    // Store marker by place_id if available, otherwise by a generated key
    if (place.place_id) {
      markersByPlaceId.set(place.place_id, marker);
    } else {
      // Use location as fallback key for places without place_id
      const key = `${place.geometry.location.lat()},${place.geometry.location.lng()}`;
      markersByPlaceId.set(key, marker);
    }
    markers.push(marker);
  });

  return markersByPlaceId;
}

function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

function getSearchRadiusFromBounds() {
  const bounds = map.getBounds();
  if (!bounds || !google.maps.geometry?.spherical) {
    return DEFAULT_RADIUS_METERS;
  }

  const center = bounds.getCenter();
  const northEast = bounds.getNorthEast();
  return google.maps.geometry.spherical.computeDistanceBetween(
    center,
    northEast
  );
}

window.initMap = initMap;
