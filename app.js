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

  map = new google.maps.Map(mapElement, {
    center: DEFAULT_LOCATION,
    zoom: MAP_ZOOM,
    mapId: "DEMO_MAP_ID",
  });

  infoWindow = new google.maps.InfoWindow();
  service = new google.maps.places.PlacesService(map);

  locateButton.addEventListener("click", () => {
    locateButton.disabled = true;
    locateUserLocation()
      .then((location) => {
        errorElement.hidden = true;
        updateMap(location, "Your location");
        fetchNearbyBusinesses(location);
      })
      .catch((error) => {
        errorElement.hidden = false;
        errorElement.textContent = error.message;
        updateMap(DEFAULT_LOCATION, "Default location");
        fetchNearbyBusinesses(DEFAULT_LOCATION);
      })
      .finally(() => {
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

function fetchNearbyBusinesses(location) {
  const request = {
    location,
    radius: DEFAULT_RADIUS_METERS,
    type: ["store"],
    openNow: false,
  };

  service.nearbySearch(request, (results, status) => {
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results) {
      renderResults([]);
      return;
    }

    const sortedResults = results
      .slice(0, 10)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));

    renderResults(sortedResults);
    renderMarkers(sortedResults);
  });
}

function renderResults(results) {
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
      if (place.geometry?.location) {
        map.panTo(place.geometry.location);
        map.setZoom(MAP_ZOOM + 2);
      }

      infoWindow.setContent(
        `<div class="info-window"><strong>${place.name}</strong><br/>${place.vicinity || ""}</div>`
      );
      infoWindow.open(map, markers[index + 1]);
    });

    list.appendChild(item);
  });
}

function renderMarkers(results) {
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

    markers.push(marker);
  });
}

function clearMarkers() {
  markers.forEach((marker) => marker.setMap(null));
  markers = [];
}

window.initMap = initMap;
