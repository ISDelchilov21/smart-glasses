
import re
import shlex
import subprocess
from datetime import datetime, timedelta
from urllib.parse import quote_plus

DRY_RUN = False

CONFIRM = None


def adb(*args):
    if DRY_RUN:
        print("   [dry run] adb", " ".join(args))
        return ""
    try:
        result = subprocess.run(["adb", *args], capture_output=True, encoding="utf-8", errors="replace", timeout=10)
    except FileNotFoundError:
        return "Error: adb not found. Restart VS Code after installing platform-tools."
    except subprocess.TimeoutExpired:
        return "Error: the phone did not answer."
    output = (result.stdout + result.stderr).strip()
    if "no devices" in output:
        return "Error: no phone is connected to the laptop."
    failed = result.returncode != 0 or "Error" in result.stderr
    return f"Error: {output}" if failed else output


def clean_number(phone_number):
    return "".join(c for c in phone_number if c.isdigit() or c == "+")


def find_package(app_name, installed):
    name = app_name.lower().replace(" ", "")
    if DRY_RUN:
        return f"com.example.{name}"
    packages = [line.removeprefix("package:") for line in installed.splitlines()]
    matches = [p for p in packages if name in p.lower()]
    return min(matches, key=len) if matches else None


def open_app(app_name: str) -> str:
    """Open an app on the user's phone.

    Args:
        app_name: The app's name, for example "youtube", "spotify" or "instagram".
    """
    installed = adb("shell", "pm", "list", "packages")
    if installed.startswith("Error"):
        return installed
    package = find_package(app_name, installed)
    if package is None:
        return f"No app called {app_name} is installed."
    output = adb("shell", "monkey", "-p", package, "-c", "android.intent.category.LAUNCHER", "1")
    return output if output.startswith("Error") else f"Opened {app_name}."


def make_phone_call(contact: str) -> str:
    """Call someone: opens the phone's dialer with their number; the user presses the call button.
    Use this whenever the user wants to call, phone, ring or dial someone.

    Args:
        contact: The phone number, or the person's name as saved in the user's contacts.
    """

    number, error = number_for(contact)
    if error:
        return error
    if CONFIRM is None:
        output = adb("shell", "am", "start", "-a", "android.intent.action.DIAL", "-d", f"tel:{number}")
        return output if output.startswith("Error") else f"The dialer shows {number}. The user must press call."
    if not CONFIRM(f"Should I call {contact}?"):
        return "The user said no, so nobody was called."
    output = adb("shell", "am", "start", "-a", "android.intent.action.CALL", "-d", f"tel:{number}")
    return output if output.startswith("Error") else f"Calling {contact} now."


def send_sms(contact: str, message: str) -> str:
    """Open a text message to someone with the message filled in; the user presses send.
    Use this whenever the user wants to text, message or SMS someone.

    Args:
        contact: The phone number, or the person's name as saved in the user's contacts.
        message: The text of the message.
    """
    number, error = number_for(contact)
    if error:
        return error
    output = adb("shell", "am", "start", "-a", "android.intent.action.SENDTO", "-d", f"sms:{number}",
                 "--es", "sms_body", shlex.quote(message))
    return output if output.startswith("Error") else f"The message to {number} is ready. The user must press send."


NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "fifteen": 15, "thirty": 30, "forty five": 45, "forty-five": 45,
}


def parse_alarm_time(text):
    """Turn a spoken time into (hour, minute) in 24-hour time, or None if there is no time in it.

    "2 pm" -> (14, 0), "7:30 am" -> (7, 30), "quarter past six in the evening" -> (18, 15),
    "in 20 minutes" -> now + 20 minutes. The small LLM got "2 pm" wrong sometimes; code doesn't.
    """
    t = text.lower().replace("a.m.", "am").replace("p.m.", "pm")
    if "noon" in t or "midday" in t:
        return 12, 0
    if "midnight" in t:
        return 0, 0
    for word, number in NUMBER_WORDS.items():
        t = re.sub(rf"\b{word}\b", str(number), t)
    t = re.sub(r"(\d)([a-z])", r"\1 \2", t)

    later = re.search(r"\b(\d+) (minute|min|hour)", t)
    if later:
        amount = int(later.group(1))
        delta = timedelta(hours=amount) if later.group(2) == "hour" else timedelta(minutes=amount)
        when = datetime.now() + delta
        return when.hour, when.minute

    clock = re.search(r"\b(\d{1,2})[:.h ](\d{2})\b", t) or re.search(r"\b(\d{1,2})(\d{2})\b", t)
    if clock:
        hour, minute = int(clock.group(1)), int(clock.group(2))
    else:
        alone = re.search(r"\b(\d{1,2})\b", t)
        if not alone:
            return None
        hour, minute = int(alone.group(1)), 0
    if "quarter past" in t:
        minute = 15
    elif "half past" in t:
        minute = 30
    elif "quarter to" in t:
        hour, minute = hour - 1, 45

    if re.search(r"\bpm\b|afternoon|evening", t) and hour < 12:
        hour += 12
    elif re.search(r"\bnight\b|tonight", t) and 6 <= hour < 12:
        hour += 12
    elif re.search(r"\bam\b|morning", t) and hour == 12:
        hour = 0
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour, minute


def set_alarm(time: str) -> str:
    """Set an alarm on the user's phone. Only for alarms or waking up at a clock time, never for calling people.

    Args:
        time: The alarm time exactly as the user said it, with words like am, pm, morning or evening.
    """
    parsed = parse_alarm_time(time)
    if parsed is None:
        return f"Error: '{time}' is not a time. Ask the user what time the alarm should be."
    hour, minute = parsed
    if DRY_RUN:
        print(f"   [dry run] set alarm for {hour}:{minute:02d}")
        return f"Set an alarm for {hour}:{minute:02d}."
    output = adb("shell", "am", "start", "-a", "android.intent.action.SET_ALARM", "--ei", "android.intent.extra.alarm.HOUR", str(hour),
                 "--ei", "android.intent.extra.alarm.MINUTES", str(minute))
    return output if output.startswith("Error") else f"Set an alarm for {hour}:{minute:02d}."


def battery_report(dumpsys_battery):
    """`dumpsys battery` prints lines like "level: 85" -> "Battery 85%, charging." """
    info = {}
    for line in dumpsys_battery.splitlines():
        key, colon, value = line.partition(":")
        if colon:
            info[key.strip()] = value.strip()
    if "level" not in info:
        return "Battery level could not be read."
    percent = round(int(info["level"]) * 100 / int(info.get("scale", 100)))
    state = {"2": "charging", "5": "full"}.get(info.get("status"), "not charging")
    return f"Battery {percent}%, {state}."


def wifi_report(cmd_wifi_status):
    """`cmd wifi status` (Android 11 and newer) prints e.g. 'Wifi is connected to "HomeNet"'."""
    connected = re.search(r'connected to "(.*?)"', cmd_wifi_status)
    if connected:
        return f"Wi-Fi connected to {connected.group(1)}."
    if "Wifi is disabled" in cmd_wifi_status:
        return "Wi-Fi off."
    if "Wifi is enabled" in cmd_wifi_status:
        return "Wi-Fi on, not connected."
    return "Wi-Fi status could not be read."


def storage_report(df_output):
    """`df -h /data` prints a header line, then e.g. "/dev/block/dm-8  110G  60G  50G  55% /data"."""
    lines = df_output.splitlines()
    columns = lines[-1].split() if len(lines) > 1 else []
    return f"{columns[3]} of storage free." if len(columns) >= 4 else "Free storage could not be read."


def bluetooth_report(bluetooth_on):
    """`settings get global bluetooth_on` returns "1" or "0"."""
    return {"1": "Bluetooth on.", "0": "Bluetooth off."}.get(bluetooth_on.strip(), "Bluetooth status could not be read.")


def dnd_report(zen_mode):
    """`settings get global zen_mode` returns a number: 0 = off, 1-3 = different kinds of on."""
    modes = {"0": "off", "1": "on (priority only)", "2": "on (total silence)", "3": "on (alarms only)"}
    mode = modes.get(zen_mode.strip())
    return f"Do Not Disturb {mode}." if mode else "Do Not Disturb status could not be read."


STATUS_CHECKS = {
    "battery": (["dumpsys", "battery"], battery_report),
    "wifi": (["cmd", "wifi", "status"], wifi_report),
    "bluetooth": (["settings", "get", "global", "bluetooth_on"], bluetooth_report),
    "do not disturb": (["settings", "get", "global", "zen_mode"], dnd_report),
    "storage": (["df", "-h", "/data"], storage_report),
}


def phone_status(item: str) -> str:
    """Check the phone's status.

    Args:
        item: What to check: "all" for a full status report, or only one of "battery", "wifi",
            "bluetooth", "do not disturb" or "storage".
    """
    asked = item.lower().replace(" ", "").replace("-", "")
    wanted = [key for key in STATUS_CHECKS if key.replace(" ", "") in asked]
    if not wanted:
        wanted = list(STATUS_CHECKS)
    sentences = []
    for key in wanted:
        command, report = STATUS_CHECKS[key]
        output = adb("shell", *command)
        if output.startswith(("Error: no phone", "Error: adb not found")):
            return output
        sentences.append(report(output))
    return " ".join(sentences)


def navigate_to(destination: str) -> str:
    """Start Google Maps turn-by-turn navigation to a place.

    Args:
        destination: Where the user wants to go: an address or the name of a place.
    """
    output = adb("shell", "am", "start", "-a", "android.intent.action.VIEW",
                 "-d", f"google.navigation:q={quote_plus(destination)}")
    return output if output.startswith("Error") else f"Google Maps is navigating to {destination}."


def parse_contacts(content_output):
    """`content query` prints rows like "Row: 0 display_name=Mom, data1=+359 88 123 4567" -> [("Mom", "+359 88 123 4567")]."""
    contacts = []
    for line in content_output.splitlines():
        row = re.search(r"display_name=(.*), data1=(.*)$", line)
        if row:
            contacts.append((row.group(1), row.group(2)))
    return contacts


def match_quality(contact, wanted):
    """How well a contact's name matches what the user said: 3 = the same name ("mom" -> "Mom"),
    2 = one of its words ("alex" -> "Alex Petrov"), 1 = part of a word ("mom" -> "Brother Momo"), 0 = no match."""
    contact = contact.lower()
    if contact == wanted:
        return 3
    if wanted in contact.split():
        return 2
    return 1 if wanted in contact else 0


def contacts_matching(name):
    """Returns (matches, error): matches are the best-matching (contact, number) pairs, without duplicates."""
    if DRY_RUN:
        return [(name.title(), "0000000000")], None
    output = adb("shell", "content", "query", "--uri", "content://com.android.contacts/data/phones",
                 "--projection", "display_name:data1")
    if output.startswith("Error"):
        return [], output
    wanted = name.lower().strip()
    contacts = parse_contacts(output)
    best = max((match_quality(contact, wanted) for contact, _ in contacts), default=0)
    if best == 0:
        return [], None
    matches = []
    for contact, number in contacts:
        if match_quality(contact, wanted) == best and (contact, clean_number(number)) not in matches:
            matches.append((contact, clean_number(number)))
    return matches, None


def number_for(contact):
    """Turn what the LLM passed (a number, or a contact's name like "mom") into digits. Returns (number, error).

    Looking the name up here, instead of making the LLM call find_contact first and then make_phone_call,
    turns two steps into one: small models often stop after the first step.
    """
    number = clean_number(contact)
    if number:
        return number, None
    contact = contact.strip().removeprefix("my ").removeprefix("My ")
    matches, error = contacts_matching(contact)
    if error:
        return None, error
    if not matches:
        return None, f"Error: there is no contact called {contact}. Ask the user for the number."
    if len(matches) > 1:
        names = [name for name, _ in matches]
        options = ", ".join(name if names.count(name) == 1 else f"{name} ({number})" for name, number in matches[:5])
        return None, f"Error: several contacts match {contact}: {options}. Ask the user which one."
    return clean_number(matches[0][1]), None


def find_contact(name: str) -> str:
    """Tell the user a person's phone number from their contacts.
    Only for questions about a number; to call or text someone, use make_phone_call or send_sms instead.

    Args:
        name: The person's name as the user said it.
    """
    matches, error = contacts_matching(name)
    if error:
        return error
    if not matches:
        return f"There is no contact called {name}."
    return "; ".join(f"{contact}: {number}" for contact, number in matches[:5])


SYSTEM_APPS = {"android", "com.android.systemui"}
GENERIC_PARTS = {"com", "org", "net", "android", "google", "app", "apps"}


KNOWN_APPS = {
    "com.zhiliaoapp.musically": "tiktok",
    "com.instagram.barcelona": "threads",
    "com.facebook.orca": "messenger",
    "com.google.android.googlequicksearchbox": "google",
}


def app_label(package):
    """A readable app name from a package: com.instagram.android -> instagram, bg.telenor.mytelenor -> telenor."""
    if package in KNOWN_APPS:
        return KNOWN_APPS[package]

    parts = [part for part in package.split(".") if part not in GENERIC_PARTS and len(part) > 2]
    return parts[0] if parts else package


def parse_notifications(dumpsys_output):
    """Pull each notification's app, title and text out of `dumpsys notification --noredact`.

    A notification starts with a line "NotificationRecord(... pkg=com.whatsapp ...)"; further down,
    its extras contain lines like "android.title=String (Alex)" and "android.text=String (are you coming?)".
    """
    notifications = []
    for line in dumpsys_output.splitlines():
        line = line.strip()
        if line.startswith("NotificationRecord("):
            package = re.search(r"pkg=(\S+)", line)
            notifications.append({"app": package.group(1) if package else "?", "title": "", "text": ""})
            continue
        field = re.match(r"android\.(title|text)=\w+ \((.*?)\)?$", line)
        if field and notifications:
            notifications[-1][field.group(1)] = field.group(2)
    return notifications


def read_notifications(app: str) -> str:
    """Read the notifications on the user's phone, such as new messages and who sent them.

    Args:
        app: "all" for the notifications of every app, or the name of one app.
    """
    output = adb("shell", "dumpsys", "notification", "--noredact")
    if output.startswith("Error"):
        return output
    wanted = app.lower().replace(" ", "")
    by_app = {}
    for n in parse_notifications(output):
        if n["app"] in SYSTEM_APPS or not (n["title"] or n["text"]):
            continue
        asked_for_one_app = wanted not in ("all", "")
        if asked_for_one_app and wanted not in n["app"].lower() and wanted not in app_label(n["app"]):
            continue
        item = f"{n['title']}: {n['text'][:120]}"
        items = by_app.setdefault(app_label(n["app"]), [])
        if item not in items:
            items.append(item)
    if not by_app:
        return "There are no notifications." if wanted in ("all", "") else f"There are no notifications from {app}."
    parts = []
    for app, items in by_app.items():
        more = f" (+{len(items) - 2} more)" if len(items) > 2 else ""
        parts.append(f"{app}: " + "; ".join(items[:2]) + more)
    return " | ".join(parts)

TOOLS = [open_app, make_phone_call, send_sms, phone_status, navigate_to, read_notifications, set_alarm, find_contact]
