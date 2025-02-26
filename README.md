# MMM-Biathlon

 ![pngimg com - biathlon_PNG14](https://github.com/user-attachments/assets/140558fd-a760-497b-ad78-713a027bb5ba)
 
MMM-Biathlon is a MagicMirror module that retrieves and displays biathlon race results and upcoming events. It relies on the official biathlon API to provide up-to-date information.

### Features:
- Displays biathlon race results, including rankings, times, and shooting accuracy.<br>
- Shows upcoming events with details on location and dates.<br>

###  Supports the following languages:
- French
- Spanish
- Italian
- Norwegian
- German
- Chinese
  
### Customization options:
- Number of displayed entries
- Transition interval
- Event types
- Automatic updates of results and event information at predefined intervals.
  
### With MMM-Biathlon, biathlon enthusiasts can follow the latest competition results and stay updated on their favorite athletes' performances directly on their MagicMirror!

## ScreenShots

![vncviewer_1Heje9nXTd](https://github.com/user-attachments/assets/69054c01-1716-46f8-94c7-86ea2588425f)
![Capture](https://github.com/user-attachments/assets/3786dd11-dc00-4aad-8be1-89825e1a0b40)
![Capture](https://github.com/user-attachments/assets/9d6b9759-3a79-4df5-a3ae-0f7b3161c69f)



## Installation

### Install

In your terminal, go to your [MagicMirror²][mm] Module folder and clone MMM-Template:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/2hdlockness/MMM-Biathlon
```

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:

```js
{
  module: "MMM-Biathlon",
  position: "top_left",
  header: "Biathlon Results",
  config: {
  }
},
```

Or you could use all the options:

```js
{
module: "MMM-Biathlon",
position: "top_left",
header: "Biathlon Results",
    config: {
        showNextEvent: true,
        showtime: true,
        showshoot: true,
        maximumEntries: 5,
        transitionInterval: 20 * 1000,
        updateInterval: 60 * 60 * 1000,
        EventClassificationId: ["BTSWRLCP","BTSWRLCH"]
    }
},
```

## Configuration options

Option|Possible values|Default|Description
------|------|------|-----------
`showNextEvent`|`true`<br> `false`|true|Show or hide upcoming events
`showtime`|`true`<br> `false`|true|Show or hide total time
`showshoot`|`true`<br> `false`|true|Show or hide shooting results
`maximumEntries`|`number`|5|Number of entries to display
`transitionInterval`|`number`|20 * 1000|Transition interval between events (in ms)<br> default 20s
`updateInterval`|`number`|60 * 60 * 1000|Data update interval (in ms)<br> default 1h
`EventClassificationId`|`SBSWRLCH`<br>`BTSIBUCP`<br>`BTSWRLCP`<br>`BTJIBUCP`<br>`BTSWRLUG`<br>`BTJCEUCH`<br>`BTSCEUCH`<br>`BTJCEUOF`<br>`BTSWRLCH`<br>`BTJWRLCH`<br>|["BTSWRLCP","BTSWRLCH"]|List of competitions.<br>See below for competition details.

Competition details|Description
------|-----------
`BTSWRLCP`|BMW IBU World Cup Biathlon  
`BTSWRLCH`|BMW IBU World Championships Biathlon  
`BTJCEUCH`|IBU Junior Open European Championships  
`BTJIBUCP`|IBU Junior Cup Biathlon  
`BTJWRLCH`|IBU Youth/Junior World Championships  
`BTSCEUCH`|IBU Open European Championships Biathlon  
`BTSIBUCP`|IBU Cup Biathlon  
`SBSWRLCH`|IBU Summer Biathlon World Championships  
`BTSWRLUG`|FISU World University Games  
`BTJCEUOF`|European Youth Winter Olympic Festival

### Update

```bash
cd ~/MagicMirror/modules/MMM-Biathlon
git pull
```

## Donate
If you like this module and feel generous!

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/donate?hosted_button_id=DQW6PLJLDDB8L)

Thank you!

## Credits
* Authors:<br>
@2hdlockness
* License: MIT
