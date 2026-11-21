const modes = {
  arm_home: [1, "Arm home", "armed_home"],
  arm_away: [2, "Arm away", "armed_away"],
  arm_night: [4, "Arm night", "armed_night"],
  arm_custom_bypass: [16, "Arm with bypass", "armed_custom_bypass"],
  arm_vacation: [32, "Arm vacation", "armed_vacation"],
};

const states = {
  disarmed: "Disarmed",
  armed_home: "Armed home",
  armed_away: "Armed away",
  armed_night: "Armed night",
  armed_vacation: "Armed vacation",
  armed_custom_bypass: "Armed with bypass",
  arming: "Exit delay",
  pending: "Entry delay",
  triggered: "Alarm triggered",
  disarming: "Disarming",
};

class AlarmKeypadCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; color-scheme: dark; }
        [hidden] { display: none !important; }
        ha-card {
          --accent: #a1ecd8;
          box-sizing: border-box; padding: clamp(18px, 5vw, 32px); border-radius: 28px;
          background: radial-gradient(ellipse at top left, #2c55579c, transparent 68%), #101b24ed;
          backdrop-filter: blur(18px); color: #f2fafb;
          border: 1px solid #bdeeff30; box-shadow: 0 18px 48px #050d153d;
          font-family: Inter, system-ui, sans-serif;
        }
        header { display: flex; gap: 14px; align-items: center; margin-bottom: 22px; }
        ha-icon { color: var(--accent); background: #a1ecd81a; border-radius: 14px; padding: 12px; }
        h2 { margin: 0 0 4px; font-size: clamp(20px, 4vw, 28px); overflow-wrap: anywhere; }
        #state { color: var(--accent); font: 600 13px ui-monospace, monospace; letter-spacing: .05em; }
        ha-card[data-alert] { --accent: #ffb3a0; }
        input, button { box-sizing: border-box; color: inherit; font: inherit; }
        input {
          width: 100%; padding: 14px; border: 1px solid #bdeeff36; border-radius: 12px;
          background: #080f17a0; text-align: center; font: 600 18px ui-monospace, monospace;
        }
        input::placeholder { color: #b6c7cb; font-size: 14px; }
        #keys, #actions { display: grid; gap: 8px; margin-top: 10px; }
        #keys { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        #actions { grid-template-columns: repeat(auto-fit, minmax(min(100%, 115px), 1fr)); }
        button {
          min-height: 54px; padding: 8px 4px; border: 1px solid #bdeeff26;
          border-radius: 13px; background: #c5ebff13; cursor: pointer; touch-action: manipulation;
        }
        button[data-digit] { font: 500 24px ui-monospace, monospace; }
        button[data-action] { background: var(--accent); color: #12272a; font-weight: 700; }
        @media (hover: hover) { button:hover:not(:disabled) { filter: brightness(1.16); } }
        button:active:not(:disabled) { filter: brightness(.86); }
        button:disabled { opacity: .52; cursor: default; }
        :focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        #feedback { min-height: 1.3em; margin: 12px 0 0; font-size: 13px; color: #d5e5e7; }
      </style>
      <ha-card>
        <header>
          <ha-icon icon="mdi:shield-home-outline" aria-hidden="true"></ha-icon>
          <div><h2></h2><div id="state" role="status"></div></div>
        </header>
        <input type="password" aria-label="Alarm code" placeholder="Enter code" autocomplete="off"
               autocapitalize="off" spellcheck="false" />
        <div id="keys" role="group" aria-label="Numeric keypad">
          ${Array.from({ length: 9 }, (_, i) => `<button type="button" data-digit="${i + 1}">${i + 1}</button>`).join("")}
          <button type="button" data-edit="clear">Clear</button>
          <button type="button" data-digit="0">0</button>
          <button type="button" data-edit="backspace" aria-label="Delete last digit">⌫</button>
        </div>
        <div id="actions" role="group" aria-label="Alarm actions"></div>
        <p id="feedback" role="status"></p>
      </ha-card>`;
    this.code = this.shadowRoot.querySelector("input");
    this.actions = this.shadowRoot.querySelector("#actions");
    this.feedback = this.shadowRoot.querySelector("#feedback");
    this.shadowRoot.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button || button.disabled) return;
      const { digit, edit, action } = button.dataset;
      if (digit !== undefined) this.code.value += digit;
      if (edit === "clear") this.code.value = "";
      if (edit === "backspace") this.code.value = this.code.value.slice(0, -1);
      if (action) this.submit(action);
    });
  }

  setConfig(config) {
    if (typeof config.entity !== "string" || !/^alarm_control_panel\.[a-z0-9_]+$/.test(config.entity)) {
      throw new Error("Choose an alarm_control_panel entity.");
    }
    const configuredModes = config.states ?? Object.keys(modes);
    if (!Array.isArray(configuredModes) || configuredModes.some((mode) => !Object.hasOwn(modes, mode))) {
      throw new Error("Use supported arm actions in states, such as arm_home and arm_away.");
    }
    this.config = { ...config, states: [...new Set(configuredModes)] };
    this.code.value = "";
    this.finish("");
    this.update();
  }

  static getStubConfig(hass) {
    return {
      entity: Object.keys(hass?.states ?? {}).find((id) => id.startsWith("alarm_control_panel."))
        ?? "alarm_control_panel.home_alarm",
    };
  }

  getCardSize() { return 9; }

  get panel() { return this._hass?.states[this.config?.entity]; }

  set hass(hass) {
    const previous = this.panel?.state;
    this._hass = hass;
    if (previous !== this.panel?.state) {
      this.code.value = "";
      if (this.request && this.confirmed(this.request.action)) this.finish("");
      else if (!this.request) this.feedback.textContent = "";
    }
    this.update();
  }

  disconnectedCallback() {
    this.code.value = "";
    this.finish("");
  }

  confirmed(action) {
    const state = this.panel?.state;
    return action === "disarm" ? state === "disarmed" || state === "disarming"
      : state === modes[action][2] || state === "arming";
  }

  finish(message) {
    clearTimeout(this.request?.timer);
    this.request = null;
    this.feedback.textContent = message;
    this.update();
  }

  update() {
    if (!this.config) return;
    const { state, attributes = {} } = this.panel ?? {};
    const online = this._hass?.connected !== false && Object.hasOwn(states, state);
    const disarmed = state === "disarmed";
    const needsCode = online && state !== "disarming" && !!attributes.code_format
      && (!disarmed || attributes.code_arm_required !== false);
    const numeric = attributes.code_format === "number";
    const title = this.config.name ?? attributes.friendly_name ?? "Alarm keypad";
    this.shadowRoot.querySelector("h2").textContent = title;
    this.shadowRoot.querySelector("#state").textContent = online ? states[state] : "Unavailable";
    this.shadowRoot.querySelector("ha-card").toggleAttribute("data-alert",
      online && (state === "pending" || state === "triggered"));
    this.code.hidden = !needsCode;
    this.code.disabled = !!this.request;
    this.code.inputMode = numeric ? "none" : "text";
    this.code.placeholder = numeric ? "Enter PIN" : "Enter code";
    const keys = this.shadowRoot.querySelector("#keys");
    keys.hidden = !needsCode || !numeric;
    keys.querySelectorAll("button").forEach((button) => { button.disabled = !!this.request; });

    const actions = !online || state === "disarming" ? [] : disarmed
      ? this.config.states.filter((mode) => attributes.supported_features & modes[mode][0])
      : ["disarm"];
    const actionKey = actions.join(",");
    if (this.actionKey !== actionKey) {
      this.actionKey = actionKey;
      this.actions.replaceChildren(...actions.map((action) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.action = action;
        button.textContent = action === "disarm" ? "Disarm" : modes[action][1];
        return button;
      }));
    }
    for (const button of this.actions.children) button.disabled = !!this.request;
    if (!needsCode) this.code.value = "";
  }

  async submit(action) {
    if (this.request || !this.actions.querySelector(`[data-action="${action}"]:enabled`)) return;
    const code = this.code.value;
    if (!this.code.hidden && (!code || (this.code.inputMode === "none" && !/^\d+$/.test(code)))) {
      this.feedback.textContent = this.code.inputMode === "none" ? "Enter your numeric PIN." : "Enter your alarm code.";
      this.code.focus();
      this.update();
      return;
    }
    this.code.value = "";
    const request = {
      action,
      timer: setTimeout(() => {
        this.finish("The alarm did not confirm the change. Check its state and try again.");
      }, 10000),
    };
    this.request = request;
    this.feedback.textContent = "Waiting for the alarm…";
    this.update();
    try {
      await this._hass.callService("alarm_control_panel", `alarm_${action}`,
        code ? { code } : {}, { entity_id: this.config.entity });
      if (this.request === request && this.confirmed(action)) this.finish("");
    } catch {
      if (this.request === request) this.finish("The alarm rejected the request or could not be reached.");
    }
  }
}

if (!customElements.get("alarm-keypad-card")) {
  customElements.define("alarm-keypad-card", AlarmKeypadCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "alarm-keypad-card",
    name: "Alarm Keypad",
    description: "A wall-tablet keypad for a Home Assistant alarm.",
  });
}

const consoleIcons = {
  disarmed: "mdi:shield-off-outline",
  arming: "mdi:timer-outline",
  pending: "mdi:timer-alert-outline",
  triggered: "mdi:shield-alert-outline",
};

class AlarmKeypadConsoleCard extends AlarmKeypadCard {
  constructor() {
    super();
    const root = this.shadowRoot;
    const panel = root.querySelector("ha-card");
    const header = root.querySelector("header");
    header.append(root.querySelector("#state"));
    header.after(this.feedback);

    const body = document.createElement("div");
    body.id = "console-body";
    body.append(this.code, root.querySelector("#keys"), this.actions);
    panel.append(body);

    const style = document.createElement("style");
    style.textContent = `
      ha-card {
        --accent: #b6bcc2; --key-radius: 12px;
        background: #1c1c1c; border: 1px solid #363636; padding: 0;
        border-radius: 16px; overflow: hidden; backdrop-filter: none;
        box-shadow: 0 12px 28px #0004;
      }
      ha-card[data-state=disarmed] { --accent: #8add94; }
      ha-card[data-state=armed_home] { --accent: #82d5ff; }
      ha-card[data-state=armed_away], ha-card[data-state=triggered] { --accent: #ff9c97; }
      ha-card[data-state=armed_night] { --accent: #e1b4ff; }
      ha-card[data-state=arming], ha-card[data-state=pending] { --accent: #ffcd79; }
      ha-card[data-preset=mushroom] { border-radius: 24px; --key-radius: 28px; }
      ha-card[data-preset=alarmo] { border-color: color-mix(in srgb, var(--accent) 45%, #2c2c2c); }
      header {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        padding: 16px; margin: 0; border-bottom: 1px solid #303030;
      }
      header > div:first-of-type { flex: 1; min-width: min(95px, 100%); }
      h2 { margin: 0; font-size: 16px; }
      ha-icon, #state {
        color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, #1c1c1c);
        border: 1px solid color-mix(in srgb, var(--accent) 35%, #1c1c1c);
      }
      ha-icon { border-radius: 50%; padding: 9px; }
      #state { border-radius: 99px; padding: 5px 9px; font: 700 11px/1.3 system-ui; text-transform: uppercase; }
      #feedback {
        display: flex; gap: 9px; align-items: center; margin: 0; min-height: 20px;
        padding: 8px 16px; background: #161616; border-bottom: 1px solid #303030;
      }
      #feedback::before { content: ""; width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: var(--accent); }
      #console-body { padding: 16px; }
      input { background: #121212; border-color: #444; border-radius: var(--key-radius); }
      button { background: #262626; border-color: #404040; border-radius: var(--key-radius); }
      button[data-action] { background: #262626; color: #fff; }
      button[data-action=arm_home] { border-color: #528099; color: #a6dbfa; }
      button[data-action=arm_away] { border-color: #995e58; color: #ffc0b9; }
      button[data-action=arm_night] { border-color: #87669b; color: #e9caf9; }
      button[data-action=disarm] { background: #ffaaa2; color: #301312; }
    `;
    root.append(style);
  }

  setConfig(config) {
    const preset = config.preset ?? "standard";
    if (!["standard", "mushroom", "alarmo"].includes(preset)) {
      throw new Error("Choose standard, mushroom, or alarmo for preset.");
    }
    this.shadowRoot.querySelector("ha-card").dataset.preset = preset;
    super.setConfig(config);
  }

  update() {
    super.update();
    if (!this.config) return;
    const root = this.shadowRoot;
    const state = root.querySelector("#state").textContent === "Unavailable" ? "unavailable" : this.panel.state;
    root.querySelector("ha-card").dataset.state = state;
    root.querySelector("ha-icon").setAttribute("icon", consoleIcons[state] ?? "mdi:shield-lock-outline");
    this.feedback.hidden = !this.feedback.textContent;
    root.querySelector("#console-body").hidden = this.code.hidden && !this.actions.childElementCount;
  }
}

if (!customElements.get("alarm-keypad-console-card")) {
  customElements.define("alarm-keypad-console-card", AlarmKeypadConsoleCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "alarm-keypad-console-card",
    name: "Alarm Keypad Console",
    description: "A charcoal keypad with a color-coded alarm status.",
  });
}
