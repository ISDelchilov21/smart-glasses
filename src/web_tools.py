import json
import os
import urllib.error
import urllib.parse
import urllib.request

LOCATION = None

HERE_WORDS = {"", "here", "my location", "current location", "near me", "outside", "my city"}

WEATHER_CODES = {
    0: "clear sky", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog",
    51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
    61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
    71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
    80: "light showers", 81: "showers", 82: "heavy showers", 85: "snow showers", 86: "heavy snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with hail",
}


def get_json(url, body=None, headers=None, tries=2):
    data = json.dumps(body).encode() if body is not None else None
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", **(headers or {})})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.load(response)
        except urllib.error.HTTPError:
            raise
        except OSError:
            if attempt == tries - 1:
                raise


def find_place(name):
    """Coordinates of a place by its name, from Open-Meteo's free geocoding: "Burgas" -> (42.5, 27.47, "Burgas")."""
    query = urllib.parse.urlencode({"name": name, "count": 1, "language": "en"})
    results = get_json(f"https://geocoding-api.open-meteo.com/v1/search?{query}").get("results")
    if not results:
        return None
    return results[0]["latitude"], results[0]["longitude"], results[0]["name"]


def get_weather(place: str) -> str:
    """Get the current weather and today's forecast.
    Use this for any question about the weather, temperature, rain, wind, or how hot or cold it is.

    Args:
        place: The city or place the user asked about, or "here" for where the user is now.
    """
    try:
        if place.strip().lower() in HERE_WORDS:
            if LOCATION is None:
                return "Error: the user's location is unknown. Ask the user which city."
            latitude, longitude = LOCATION["latitude"], LOCATION["longitude"]
            name = LOCATION.get("city") or "Where you are"
        else:
            found = find_place(place)
            if found is None:
                return f"Error: there is no place called {place}."
            latitude, longitude, name = found
        query = urllib.parse.urlencode({
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,weather_code,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "forecast_days": 1,
            "timezone": "auto",
        })
        data = get_json(f"https://api.open-meteo.com/v1/forecast?{query}")
    except OSError as error:
        return f"Error: the weather service did not answer ({error})."
    now, today = data["current"], data["daily"]
    sky = WEATHER_CODES.get(now["weather_code"], "unknown weather")
    rain = today["precipitation_probability_max"][0] or 0
    return (
        f"{name}: {round(now['temperature_2m'])}°C, {sky}, wind {round(now['wind_speed_10m'])} km/h. "
        f"Today {round(today['temperature_2m_min'][0])} to {round(today['temperature_2m_max'][0])}°C, "
        f"{rain}% chance of rain."
    )


def search_web(query: str) -> str:
    """Look up current information on the internet: news, sports results, prices, recent events, or anything you are not sure about.

    Args:
        query: What to search for, in a few words.
    """
    key = os.environ.get("TAVILY_API_KEY")
    if not key:
        return "Error: web search is not set up, because TAVILY_API_KEY is missing in server/.env."
    try:
        data = get_json(
            "https://api.tavily.com/search",
            {"query": query, "max_results": 3, "include_answer": True, "search_depth": "basic"},
            {"Authorization": f"Bearer {key}"},
        )
    except OSError as error:
        return f"Error: the search did not work ({error})."
    if data.get("answer"):
        return data["answer"]
    results = data.get("results") or []
    return " | ".join(f"{r['title']}: {r['content'][:200]}" for r in results) or "The search found nothing."


TOOLS = [get_weather, search_web]
