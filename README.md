# Home Assistant Alarm Keypads

Two dashboard cards for an existing Home Assistant `alarm_control_panel` entity. **Alarm Keypad** is a glass-style wall-tablet card. **Alarm Keypad Console** uses a charcoal layout, a color-coded status pill, and tactile keypad buttons.

## Install

[![Install in Home Assistant](https://my.home-assistant.io/badges/marketplace_repository.svg)](https://my.home-assistant.io/redirect/marketplace_repository/?owner=yanke7&repository=home-assistant-alarm&category=plugin)

Open the repository in Home Assistant Marketplace and select **Install**. Connect GitHub in Marketplace if prompted to add this custom repository. On installations using HACS, add `https://github.com/yanke7/home-assistant-alarm` as a custom repository in the **Dashboard** category, then download it and reload your browser.

### Manual install

1. Download [home-assistant-alarm.js](home-assistant-alarm.js) and copy it into `/config/www/`. If you just created the `www` folder, restart Home Assistant.
2. Under **Settings → Dashboards → Resources**, add `/local/home-assistant-alarm.js` as a **JavaScript module**. Enable Advanced Mode in your profile if Resources is hidden.
3. Reload your browser. The one resource registers both cards.

## Add a card

Edit your dashboard and look for **Alarm Keypad** or **Alarm Keypad Console** in the card picker. You can also add a **Manual** card with this YAML and replace the example entity ID with your alarm.

```yaml
type: custom:alarm-keypad-console-card
entity: alarm_control_panel.home_alarm
name: House Alarm
preset: standard
states:
  - arm_home
  - arm_away
  - arm_night
```

- Use `type: custom:alarm-keypad-card` for the glass-style card.
- The Console's optional `preset` accepts `standard`, `mushroom` (rounded controls), or `alarmo` (state-tinted border). These are visual presets included in the module.
- Both cards use the entity's friendly name by default and show every supported arming mode unless you configure `states`.
- Configure PIN requirements in the alarm integration. The cards mask input and submit the code to the panel for validation. Entry and exit delay states come from Home Assistant.

## Physical keypads

On a wall tablet, open a dashboard with either card in the Home Assistant app or browser. For standalone hardware keypads, use the device integration that supports your model and connect it to the same alarm entity. PIN handling and status feedback depend on the hardware and its integration.
