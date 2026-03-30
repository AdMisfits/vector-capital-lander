(function () {
  var DEFAULT_CONFIG = {
    brandName: "Smart Lead Capture",
    funnelKey: "default-smart-capture",
    pageTitle: "Smart Lead Capture",
    stepLabels: {
      form: "Answer a few questions",
      booking: "Book your event"
    },
    hero: {
      eyebrow: "Lead screen",
      title: "Book your next call",
      description: "Answer a few short questions before the calendar unlocks."
    },
    calendar: {
      url: "",
      title: "Your booking page",
      kicker: "Calendar preview",
      note: "Complete the intake on the left to unlock the calendar.",
      embedScriptUrl: "https://link.msgsndr.com/js/form_embed.js",
      confirmationPath: "/confirmation",
      confirmationUrl: "",
      allowedMessageOrigins: [
        "https://api.leadconnectorhq.com",
        "https://link.msgsndr.com"
      ]
    },
    privacy: {
      text: "",
      linkLabel: "",
      linkUrl: ""
    },
    storage: {
      supabaseUrl: "",
      supabaseAnonKey: "",
      table: "smart_leads",
      eventsTable: "smart_lead_events",
      webhookUrl: ""
    },
    theme: {
      accent: "#0f172a",
      accentHover: "#1e293b",
      accentSoft: "#e2e8f0"
    },
    legalLinks: [],
    steps: [],
    qualification: {
      mode: "all",
      rules: [],
      success: {
        title: "You are all set",
        description: "Choose a time that works for you.",
        buttonLabel: "Choose a time",
        highlights: []
      },
      failure: {
        title: "Thanks for your interest",
        description: "This offer is not currently available based on the answers provided.",
        ctaLabel: "",
        ctaUrl: ""
      }
    },
    trackingKeys: [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
      "ttclid",
      "wbraid",
      "gbraid",
      "country",
      "MB"
    ]
  };

  var config = mergeConfig(DEFAULT_CONFIG, window.SMART_CAPTURE_CONFIG || {});
  var state = {
    answers: {},
    currentStepIndex: 0,
    sessionId: "",
    leadId: null,
    status: "draft",
    qualified: null,
    busy: false,
    bookingCompleted: false,
    isMobileView: false
  };

  var storageKeys = {
    session: "smart-capture:" + config.funnelKey + ":session",
    draft: "smart-capture:" + config.funnelKey + ":draft"
  };

  var dom = {};

  init();

  function init() {
    cacheDom();
    document.title = config.pageTitle || config.hero.title || DEFAULT_CONFIG.pageTitle;
    state.sessionId = readStorage(storageKeys.session) || createUuid();
    writeStorage(storageKeys.session, state.sessionId);

    captureTrackingParams();
    hydrateDraft();
    applyTheme();
    loadEmbedScript();
    bindEvents();
    renderLegalLinks();
    renderStaticCopy();
    state.isMobileView = isPrimaryMobile();
    syncPageState();
    syncCalendarFrame(state.status === "qualified");
    render();
  }

  function cacheDom() {
    dom.brandBadge = document.getElementById("brandBadge");
    dom.stepPillForm = document.getElementById("stepPillForm");
    dom.stepPillBooking = document.getElementById("stepPillBooking");
    dom.panelEyebrow = document.getElementById("panelEyebrow");
    dom.stepMeta = document.getElementById("stepMeta");
    dom.panelTitle = document.getElementById("panelTitle");
    dom.panelDescription = document.getElementById("panelDescription");
    dom.panelBody = document.getElementById("panelBody");
    dom.primaryAction = document.getElementById("primaryAction");
    dom.secondaryAction = document.getElementById("secondaryAction");
    dom.statusMessage = document.getElementById("statusMessage");
    dom.calendarTitle = document.getElementById("calendarTitle");
    dom.calendarKicker = document.getElementById("calendarKicker");
    dom.calendarNote = document.getElementById("calendarNote");
    dom.calendarOverlay = document.getElementById("calendarOverlay");
    dom.calendarOverlayTitle = document.getElementById("calendarOverlayTitle");
    dom.calendarOverlayCopy = document.getElementById("calendarOverlayCopy");
    dom.calendarPlaceholder = document.getElementById("calendarPlaceholder");
    dom.calendarPlaceholderText = document.getElementById("calendarPlaceholderText");
    dom.bookingFrame = document.getElementById("bookingFrame");
    dom.legalLinks = document.getElementById("legalLinks");
    dom.calendarPanel = document.getElementById("calendarPanel");
  }

  function bindEvents() {
    dom.primaryAction.addEventListener("click", handlePrimaryAction);
    dom.secondaryAction.addEventListener("click", handleSecondaryAction);
    dom.panelBody.addEventListener("input", handleFieldInput);
    dom.panelBody.addEventListener("change", handleFieldInput);
    window.addEventListener("message", handleCalendarMessage);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("load", function () {
      syncCalendarFrame(state.status === "qualified");
    });
  }

  function renderStaticCopy() {
    dom.brandBadge.textContent = config.brandName || DEFAULT_CONFIG.brandName;
    dom.stepPillForm.textContent = config.stepLabels.form || DEFAULT_CONFIG.stepLabels.form;
    dom.stepPillBooking.textContent = config.stepLabels.booking || DEFAULT_CONFIG.stepLabels.booking;
    dom.calendarTitle.textContent = config.calendar.title || DEFAULT_CONFIG.calendar.title;
    dom.calendarKicker.textContent = config.calendar.kicker || DEFAULT_CONFIG.calendar.kicker;
    dom.calendarNote.textContent = config.calendar.note || DEFAULT_CONFIG.calendar.note;
  }

  function render() {
    syncPageState();

    if (!config.steps || !config.steps.length) {
      renderEmptyState();
      return;
    }

    updateStepPills();

    if (state.status === "qualified" || state.status === "disqualified") {
      renderResult();
      return;
    }

    renderStep();
  }

  function renderEmptyState() {
    dom.panelEyebrow.textContent = config.hero.eyebrow || DEFAULT_CONFIG.hero.eyebrow;
    dom.stepMeta.textContent = "Setup required";
    dom.panelTitle.textContent = "Add at least one step in config.js";
    dom.panelDescription.textContent = "The smart capture shell is loaded, but the question flow has not been configured yet.";
    dom.panelBody.innerHTML =
      '<div class="result-shell">' +
      '  <div class="result-state failure">' +
      '    <div class="result-icon failure">' + failureIconSvg() + "</div>" +
      '    <h3 class="result-title">No lead flow configured</h3>' +
      '    <p class="result-copy">Open <code>config.js</code>, add your steps, then refresh the page.</p>' +
      "  </div>" +
      "</div>";
    dom.primaryAction.hidden = true;
    dom.secondaryAction.hidden = true;
    updateStatusMessage("", false);
    updateCalendarLock(false, "Calendar locked", "Add your steps and booking URL to preview the live flow.");
  }

  function renderStep() {
    var step = config.steps[state.currentStepIndex];
    var totalSteps = config.steps.length;
    dom.panelEyebrow.textContent = step.eyebrow || config.hero.eyebrow || DEFAULT_CONFIG.hero.eyebrow;
    dom.stepMeta.textContent = "Step " + (state.currentStepIndex + 1) + " of " + totalSteps;
    dom.panelTitle.textContent = step.title || config.hero.title || DEFAULT_CONFIG.hero.title;
    dom.panelDescription.textContent = step.description || config.hero.description || DEFAULT_CONFIG.hero.description;
    dom.panelDescription.hidden = !dom.panelDescription.textContent;

    dom.panelBody.innerHTML = buildStepMarkup(step);

    dom.primaryAction.hidden = false;
    dom.primaryAction.textContent = step.buttonLabel || "Continue";
    dom.primaryAction.disabled = state.busy;
    dom.secondaryAction.hidden = state.currentStepIndex === 0;
    dom.secondaryAction.textContent = "Back";
    dom.secondaryAction.disabled = state.busy;
    syncCalendarFrame(false);
    updateStatusMessage("", false);
    updateCalendarLock(false, "Calendar locked", config.calendar.note || DEFAULT_CONFIG.calendar.note);

    if (step.progressive) {
      setupProgressiveReveal(step);
    }
  }

  function setupProgressiveReveal(step) {
    var groups = {};
    var maxGroup = 0;

    (step.fields || []).forEach(function (field) {
      var g = field.revealGroup != null ? field.revealGroup : 0;
      if (!groups[g]) groups[g] = [];
      groups[g].push(field);
      if (g > maxGroup) maxGroup = g;
    });

    function getHighestFilledGroup() {
      for (var g = maxGroup; g >= 0; g--) {
        var allFilled = (groups[g] || []).every(function (field) {
          var val = state.answers[field.id];
          return val != null && val !== "";
        });
        if (allFilled && g < maxGroup) return g + 1;
        if (allFilled && g === maxGroup) return maxGroup;
      }
      return 0;
    }

    function syncVisibility() {
      var visibleUpTo = getHighestFilledGroup();
      for (var g = 0; g <= maxGroup; g++) {
        (groups[g] || []).forEach(function (field) {
          var wrap = dom.panelBody.querySelector('[data-field-wrap="' + field.id + '"]');
          if (!wrap) return;
          if (g <= visibleUpTo) {
            wrap.style.display = "";
            wrap.style.opacity = "1";
            wrap.style.transition = "opacity 0.3s ease";
          } else {
            wrap.style.display = "none";
            wrap.style.opacity = "0";
          }
        });
      }
    }

    syncVisibility();

    dom.panelBody.addEventListener("input", function () {
      (step.fields || []).forEach(function (field) {
        var el = dom.panelBody.querySelector('[data-field-id="' + field.id + '"]');
        if (el) state.answers[field.id] = el.value;
      });
      syncVisibility();
    });
  }

  function renderResult() {
    var qualified = state.status === "qualified";
    var resultConfig = qualified ? config.qualification.success : config.qualification.failure;
    var resultClass = qualified ? "success" : "failure";
    var icon = qualified ? successIconSvg() : failureIconSvg();
    var summaryMarkup = buildSummaryMarkup();
    var highlightsMarkup = qualified ? buildHighlightsMarkup(resultConfig.highlights || []) : "";

    dom.panelEyebrow.textContent = qualified ? "Qualified lead" : "Not a fit yet";
    dom.stepMeta.textContent = qualified ? "Calendar unlocked" : "Calendar unavailable";
    dom.panelTitle.textContent = resultConfig.title;
    dom.panelDescription.textContent = resultConfig.description;
    dom.panelDescription.hidden = !dom.panelDescription.textContent;

    dom.panelBody.innerHTML =
      '<div class="result-shell">' +
      '  <div class="result-state ' + resultClass + '">' +
      '    <div class="result-icon ' + resultClass + '">' + icon + "</div>" +
      '    <h3 class="result-title">' + escapeHtml(resultConfig.title) + "</h3>" +
      '    <p class="result-copy">' + escapeHtml(resultConfig.description || "") + "</p>" +
      "  </div>" +
      summaryMarkup +
      highlightsMarkup +
      "</div>";

    dom.secondaryAction.hidden = false;
    dom.secondaryAction.textContent = "Edit answers";
    dom.secondaryAction.disabled = state.busy;

    if (qualified) {
      dom.primaryAction.hidden = true;
      dom.secondaryAction.hidden = true;
      syncCalendarFrame(true);
      updateCalendarLock(true);
      updateStatusMessage("", false);
    } else if (resultConfig.ctaLabel && resultConfig.ctaUrl) {
      dom.primaryAction.hidden = false;
      dom.primaryAction.textContent = resultConfig.ctaLabel;
      dom.primaryAction.disabled = false;
      syncCalendarFrame(false);
      updateCalendarLock(false, "Calendar unavailable", resultConfig.description || DEFAULT_CONFIG.qualification.failure.description);
      updateStatusMessage("Lead captured. Redirecting is optional from here.", false);
    } else {
      dom.primaryAction.hidden = true;
      syncCalendarFrame(false);
      updateCalendarLock(false, "Calendar unavailable", resultConfig.description || DEFAULT_CONFIG.qualification.failure.description);
      updateStatusMessage("Lead captured.", false);
    }
  }

  function buildStepMarkup(step) {
    var fieldsMarkup = (step.fields || []).map(function (field) {
      return renderField(field);
    }).join("");

    var helper = step.helperText ? '<p class="field-note">' + escapeHtml(step.helperText) + "</p>" : "";
    var consent = "";

    if (step.consentHtml) {
      consent = '<p class="field-note">' + step.consentHtml + "</p>";
    } else if (shouldRenderPrivacy(step)) {
      consent = buildPrivacyMarkup();
    }

    return '<form class="lead-form" id="leadForm" novalidate>' + fieldsMarkup + helper + consent + "</form>";
  }

  function shouldRenderPrivacy(step) {
    if (step.showPrivacy === true) {
      return true;
    }

    return (step.fields || []).some(function (field) {
      return !!field.leadField;
    });
  }

  function buildPrivacyMarkup() {
    if (!config.privacy.text) {
      return "";
    }

    var link = "";
    if (config.privacy.linkUrl && config.privacy.linkLabel) {
      link =
        ' <a href="' + escapeAttribute(config.privacy.linkUrl) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(config.privacy.linkLabel) +
        "</a>";
    }

    return '<p class="field-note">' + escapeHtml(config.privacy.text) + link + "</p>";
  }

  function renderField(field) {
    var errorId = "error-" + field.id;
    var label = field.label ? '<span class="field-label">' + escapeHtml(field.label) + "</span>" : "";
    var hint = field.hint ? '<span class="field-hint">' + escapeHtml(field.hint) + "</span>" : "";
    var labelRow = label || hint ? '<div class="field-label-row">' + label + hint + "</div>" : "";
    var value = state.answers[field.id];
    var inputMarkup = "";

    if (field.type === "select") {
      var options = ['<option value="">' + escapeHtml(field.placeholder || "Select one") + "</option>"]
        .concat((field.options || []).map(function (option) {
          var selected = String(value || "") === String(option.value) ? " selected" : "";
          return '<option value="' + escapeAttribute(option.value) + '"' + selected + ">" + escapeHtml(option.label) + "</option>";
        }))
        .join("");

      inputMarkup =
        '<select class="select-input" id="' + escapeAttribute(field.id) + '" data-field-id="' + escapeAttribute(field.id) + '">' +
        options +
        "</select>";
    } else if (field.type === "textarea") {
      inputMarkup =
        '<textarea class="textarea-input" id="' + escapeAttribute(field.id) + '" data-field-id="' + escapeAttribute(field.id) + '" placeholder="' +
        escapeAttribute(field.placeholder || "") +
        '">' +
        escapeHtml(value || "") +
        "</textarea>";
    } else if (field.type === "radio" || field.type === "checkbox") {
      inputMarkup =
        '<div class="choice-grid">' +
        (field.options || []).map(function (option) {
          var optionValue = option.value;
          var checked = field.type === "checkbox"
            ? Array.isArray(value) && value.indexOf(optionValue) !== -1
            : String(value || "") === String(optionValue);
          var inputType = field.type === "checkbox" ? "checkbox" : "radio";

          return (
            '<label class="choice-card' + (checked ? " checked" : "") + '" data-choice-field="' + escapeAttribute(field.id) + '">' +
            '  <input type="' + inputType + '" name="' + escapeAttribute(field.id) + '" value="' + escapeAttribute(optionValue) + '"' +
            (checked ? " checked" : "") +
            ">" +
            '  <span class="choice-title">' + escapeHtml(option.label) + "</span>" +
            (option.description ? '<span class="choice-description">' + escapeHtml(option.description) + "</span>" : "") +
            "</label>"
          );
        }).join("") +
        "</div>";
    } else {
      var type = field.type || "text";
      inputMarkup =
        '<input class="text-input" id="' + escapeAttribute(field.id) + '" data-field-id="' + escapeAttribute(field.id) + '" type="' + escapeAttribute(type) + '" placeholder="' +
        escapeAttribute(field.placeholder || "") +
        '" value="' + escapeAttribute(value || "") + '"' +
        (field.autoComplete ? ' autocomplete="' + escapeAttribute(field.autoComplete) + '"' : "") +
        ">";
    }

    return (
      '<div class="field-wrap" data-field-wrap="' + escapeAttribute(field.id) + '"' +
      (field.revealGroup != null ? ' data-reveal-group="' + field.revealGroup + '"' : '') +
      '>' +
      labelRow +
      inputMarkup +
      '<div class="field-error" id="' + errorId + '"></div>' +
      "</div>"
    );
  }

  function handlePrimaryAction() {
    if (state.busy || !config.steps.length) {
      return;
    }

    if (state.status === "qualified") {
      scrollToCalendar();
      return;
    }

    if (state.status === "disqualified") {
      var failure = config.qualification.failure || {};
      if (failure.ctaUrl) {
        window.location.href = failure.ctaUrl;
      }
      return;
    }

    if (!validateCurrentStep()) {
      return;
    }

    if (state.currentStepIndex < config.steps.length - 1) {
      var completedStep = config.steps[state.currentStepIndex];
      pushDataLayer("step_complete", {
        step_id: completedStep.id,
        step_index: state.currentStepIndex + 1,
        step_total: config.steps.length
      });
      state.currentStepIndex += 1;
      persistDraft();
      render();
      focusFormTop();
      return;
    }

    submitLead();
  }

  function handleSecondaryAction() {
    if (state.busy) {
      return;
    }

    if (state.status === "qualified" || state.status === "disqualified") {
      state.status = "draft";
      state.qualified = null;
      state.currentStepIndex = Math.max(config.steps.length - 1, 0);
      state.leadId = null;
      state.bookingCompleted = false;
      persistDraft();
      render();
      return;
    }

    if (state.currentStepIndex > 0) {
      state.currentStepIndex -= 1;
      persistDraft();
      render();
    }
  }

  function handleFieldInput(event) {
    var target = event.target;
    if (!target) {
      return;
    }

    var fieldId = target.getAttribute("data-field-id") || target.name || target.id;
    if (!fieldId) {
      return;
    }

    var field = findFieldById(fieldId);
    if (!field) {
      return;
    }

    state.answers[fieldId] = readFieldValue(field);
    clearFieldError(fieldId);
    persistDraft();

    if (field.type === "radio" || field.type === "checkbox") {
      updateChoiceCards(fieldId);
    }
  }

  function validateCurrentStep() {
    var step = config.steps[state.currentStepIndex];
    var valid = true;

    (step.fields || []).forEach(function (field) {
      var value = readFieldValue(field);
      state.answers[field.id] = value;
      var error = validateField(field, value);

      if (error) {
        showFieldError(field.id, error);
        valid = false;
      } else {
        clearFieldError(field.id);
      }
    });

    persistDraft();
    return valid;
  }

  function validateField(field, value) {
    var isEmpty = value == null || value === "" || (Array.isArray(value) && value.length === 0);
    if (field.required && isEmpty) {
      return field.requiredMessage || "This field is required.";
    }

    if (isEmpty) {
      return "";
    }

    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
      return field.validationMessage || "Enter a valid email address.";
    }

    if (field.type === "tel") {
      var digits = String(value).replace(/\D/g, "");
      if (digits.length > 0 && digits.length < 7) {
        return field.validationMessage || "Enter a valid phone number.";
      }
    }

    if (field.minLength && String(value).length < field.minLength) {
      return field.validationMessage || "Please add a bit more detail.";
    }

    if (field.pattern) {
      var pattern = new RegExp(field.pattern);
      if (!pattern.test(String(value))) {
        return field.validationMessage || "Please check this answer.";
      }
    }

    return "";
  }

  function submitLead() {
    state.busy = true;
    dom.primaryAction.disabled = true;
    dom.secondaryAction.disabled = true;
    dom.primaryAction.textContent = "Saving...";
    updateStatusMessage("Saving lead and evaluating fit...", false);

    var leadId = state.leadId || createUuid();
    state.leadId = leadId;

    var qualification = evaluateQualification();
    var leadPayload = buildLeadPayload(leadId, qualification);

    persistLead(leadPayload)
      .then(function () {
        state.status = "qualified";
        state.qualified = qualification.qualified;
        persistDraft();
        pushDataLayer(qualification.qualified ? "lead_qualified" : "lead_disqualified", {
          first_name: leadPayload.first_name,
          last_name: leadPayload.last_name,
          email: leadPayload.email,
          qualified: qualification.qualified,
          answers: leadPayload.answers,
          utms: leadPayload.utms
        });
        return persistEvent("calendar_unlocked", {
          answers: leadPayload.answers,
          qualification: qualification
        });
      })
      .catch(function (error) {
        console.error("Lead persistence failed:", error);
        state.status = "qualified";
        state.qualified = qualification.qualified;
        persistDraft();
        pushDataLayer(qualification.qualified ? "lead_qualified" : "lead_disqualified", {
          qualified: qualification.qualified
        });
      })
      .finally(function () {
        state.busy = false;
        render();
        if (qualification.qualified && isPrimaryMobile()) {
          setTimeout(scrollToCalendar, 120);
        }
      });
  }

  function buildLeadPayload(leadId, qualification) {
    var lead = extractLeadFields();
    var splitName = splitFullName(lead.full_name || "");
    var qualified = qualification.qualified;
    var failureConfig = config.qualification.failure || {};
    var successConfig = config.qualification.success || {};

    return {
      id: leadId,
      session_id: state.sessionId,
      funnel_key: config.funnelKey,
      full_name: lead.full_name || null,
      first_name: lead.first_name || splitName.firstName || null,
      last_name: lead.last_name || splitName.lastName || null,
      email: lead.email || null,
      phone: lead.phone || null,
      qualified: qualified,
      qualification_label: qualified ? (successConfig.title || "qualified") : (failureConfig.title || "disqualified"),
      booking_status: qualified ? "calendar_unlocked" : "disqualified",
      answers: buildAnswerPayload(),
      utms: getTrackingSnapshot(),
      metadata: {
        page_title: document.title,
        page_url: window.location.href,
        referrer: document.referrer || null,
        timezone: detectTimezone(),
        language: navigator.language || null,
        user_agent: navigator.userAgent || null,
        viewport_width: window.innerWidth || null,
        viewport_height: window.innerHeight || null,
        calendar_url: config.calendar.url || null,
        qualification: qualification
      }
    };
  }

  function persistLead(payload) {
    var tasks = [];

    if (canUseSupabase()) {
      tasks.push(insertIntoSupabase(config.storage.table, payload));
    }

    if (config.storage.webhookUrl) {
      tasks.push(postToWebhook(config.storage.webhookUrl, {
        type: "lead_submitted",
        lead: payload
      }));
    }

    if (canUseGHL()) {
      tasks.push(persistToGHL(payload));
    }

    if (!tasks.length) {
      return Promise.resolve();
    }

    return Promise.all(tasks);
  }

  function pushDataLayer(eventName, params) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: eventName };
    if (params) {
      Object.keys(params).forEach(function (key) {
        payload[key] = params[key];
      });
    }
    window.dataLayer.push(payload);
  }

  function canUseGHL() {
    return !!(config.ghl && config.ghl.apiToken && config.ghl.locationId);
  }

  function persistToGHL(payload) {
    var ghl = config.ghl;
    var utms = payload.utms || {};
    var answers = payload.answers || {};

    var tags = (ghl.tags || []).slice();
    tags.push(payload.qualified ? "qualified" : "disqualified");
    tags.push("funnel:" + (config.funnelKey || "default"));

    var leadFieldIds = {};
    flattenFields().forEach(function (f) {
      if (f.leadField) leadFieldIds[f.id] = true;
    });

    Object.keys(answers).forEach(function (key) {
      if (leadFieldIds[key]) return;
      var val = answers[key];
      if (val && val.value) {
        tags.push(key + ":" + val.value);
      } else if (val && typeof val === "string") {
        tags.push(key + ":" + val);
      }
    });

    var customFields = [];
    var fieldMap = ghl.customFieldMap || {};
    Object.keys(fieldMap).forEach(function (answerId) {
      var val = answers[answerId];
      var label = val && val.label ? val.label : (val && val.value ? val.value : null);
      if (label) {
        customFields.push({ id: fieldMap[answerId], field_value: label });
      }
    });

    var utmFieldMap = {
      utm_source: "contact.utm_source",
      utm_medium: "contact.utm_medium",
      utm_campaign: "contact.utm_campaign",
      utm_content: "contact.utm_content",
      utm_term: "contact.utm_term"
    };
    Object.keys(utmFieldMap).forEach(function (utmKey) {
      if (utms[utmKey]) {
        customFields.push({ id: utmFieldMap[utmKey], field_value: utms[utmKey] });
      }
    });

    var body = {
      locationId: ghl.locationId,
      firstName: payload.first_name || null,
      lastName: payload.last_name || null,
      email: payload.email || null,
      phone: payload.phone || null,
      source: ghl.source || "Smart Capture",
      tags: tags,
      customFields: customFields.length ? customFields : undefined
    };

    return fetch("https://services.leadconnectorhq.com/contacts/upsert", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + ghl.apiToken,
        "Version": "2021-07-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json();
    }).then(function (data) {
      if (data.contact && data.contact.id) {
        state.ghlContactId = data.contact.id;
        console.log("GHL contact upserted:", data.contact.id);
      }
      return data;
    });
  }

  function persistEvent(eventType, payload) {
    var eventPayload = {
      lead_id: state.leadId,
      session_id: state.sessionId,
      funnel_key: config.funnelKey,
      event_type: eventType,
      payload: payload || {}
    };

    var tasks = [];

    if (canUseSupabase() && config.storage.eventsTable) {
      tasks.push(insertIntoSupabase(config.storage.eventsTable, eventPayload));
    }

    if (config.storage.webhookUrl) {
      tasks.push(postToWebhook(config.storage.webhookUrl, {
        type: eventType,
        event: eventPayload
      }));
    }

    if (!tasks.length) {
      return Promise.resolve();
    }

    return Promise.all(tasks).catch(function (error) {
      console.error("Event persistence failed:", error);
    });
  }

  function insertIntoSupabase(tableName, payload) {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      return Promise.reject(new Error("Supabase client library is unavailable"));
    }

    var client = window.supabase.createClient(config.storage.supabaseUrl, config.storage.supabaseAnonKey);
    return client.from(tableName).insert(payload).then(function (result) {
      if (result.error) {
        throw result.error;
      }
      return result.data;
    });
  }

  function postToWebhook(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) {
        return response.text().then(function (text) {
          throw new Error("Webhook failed: " + response.status + " " + text);
        });
      }
      return response.text();
    });
  }

  function canUseSupabase() {
    return !!(config.storage.supabaseUrl && config.storage.supabaseAnonKey && config.storage.table);
  }

  function evaluateQualification() {
    var rules = (config.qualification && config.qualification.rules) || [];
    if (!rules.length) {
      return {
        qualified: true,
        mode: config.qualification.mode || "all",
        results: []
      };
    }

    var results = rules.map(function (rule) {
      return {
        field: rule.field,
        label: rule.label || rule.field,
        operator: rule.operator || "equals",
        expected: rule.value,
        actual: state.answers[rule.field],
        matched: evaluateRule(rule, state.answers[rule.field])
      };
    });

    var qualified = (config.qualification.mode || "all") === "any"
      ? results.some(function (result) { return result.matched; })
      : results.every(function (result) { return result.matched; });

    return {
      qualified: qualified,
      mode: config.qualification.mode || "all",
      results: results
    };
  }

  function evaluateRule(rule, actual) {
    var operator = rule.operator || "equals";
    var expected = rule.value;

    if (operator === "equals") {
      return actual === expected;
    }

    if (operator === "not_equals") {
      return actual !== expected;
    }

    if (operator === "in") {
      return Array.isArray(expected) && expected.indexOf(actual) !== -1;
    }

    if (operator === "not_in") {
      return Array.isArray(expected) && expected.indexOf(actual) === -1;
    }

    if (operator === "includes_any") {
      return Array.isArray(actual) && Array.isArray(expected) && expected.some(function (value) {
        return actual.indexOf(value) !== -1;
      });
    }

    if (operator === "includes_all") {
      return Array.isArray(actual) && Array.isArray(expected) && expected.every(function (value) {
        return actual.indexOf(value) !== -1;
      });
    }

    if (operator === "gte" || operator === "lte" || operator === "gt" || operator === "lt") {
      var actualNumber = parseFloat(actual);
      var expectedNumber = parseFloat(expected);

      if (Number.isNaN(actualNumber) || Number.isNaN(expectedNumber)) {
        return false;
      }

      if (operator === "gte") {
        return actualNumber >= expectedNumber;
      }

      if (operator === "lte") {
        return actualNumber <= expectedNumber;
      }

      if (operator === "gt") {
        return actualNumber > expectedNumber;
      }

      return actualNumber < expectedNumber;
    }

    return false;
  }

  function syncCalendarFrame(includeLeadFields) {
    if (!config.calendar.url) {
      if (dom.calendarPlaceholderText) {
        dom.calendarPlaceholderText.innerHTML = 'Add your GHL booking URL in <code>config.js</code> to render the calendar here.';
      }
      dom.calendarPlaceholder.hidden = false;
      dom.bookingFrame.hidden = true;
      return;
    }

    if (shouldDeferCalendarEmbed()) {
      if (dom.calendarPlaceholderText) {
        dom.calendarPlaceholderText.textContent = state.status === "disqualified"
          ? "This calendar is hidden on mobile because the lead is not currently qualified."
          : "Finish the quick intake to load the live calendar on mobile.";
      }
      dom.calendarPlaceholder.hidden = false;
      dom.bookingFrame.hidden = true;
      dom.bookingFrame.src = "about:blank";
      return;
    }

    dom.calendarPlaceholder.hidden = true;
    dom.bookingFrame.hidden = false;
    dom.bookingFrame.src = buildCalendarUrl(includeLeadFields);
  }

  function buildCalendarUrl(includeLeadFields) {
    var url = new URL(config.calendar.url, window.location.href);
    var tracking = getTrackingSnapshot();

    Object.keys(tracking).forEach(function (key) {
      url.searchParams.set(key, tracking[key]);
    });

    url.searchParams.set("parentUrl", getPageUrl());
    url.searchParams.set("session_id", state.sessionId);
    url.searchParams.set("funnel_key", config.funnelKey);

    if (state.leadId) {
      url.searchParams.set("lead_id", state.leadId);
    }

    if (includeLeadFields) {
      var lead = extractLeadFields();
      var nameParts = splitFullName(lead.full_name || "");
      if (lead.full_name) {
        url.searchParams.set("name", lead.full_name);
        url.searchParams.set("full_name", lead.full_name);
      }
      if (lead.email) {
        url.searchParams.set("email", lead.email);
      }
      if (lead.phone) {
        url.searchParams.set("phone", lead.phone);
      }
      if (nameParts.firstName) {
        url.searchParams.set("first_name", nameParts.firstName);
      }
      if (nameParts.lastName) {
        url.searchParams.set("last_name", nameParts.lastName);
      }
    }

    return url.toString();
  }

  function updateCalendarLock(unlocked, title, copy) {
    dom.calendarOverlay.classList.toggle("unlocked", !!unlocked);
    if (title) {
      dom.calendarOverlayTitle.textContent = title;
    }
    if (copy) {
      dom.calendarOverlayCopy.textContent = copy;
    }
  }

  function updateStepPills() {
    var bookingActive = state.status === "qualified";
    dom.stepPillForm.classList.toggle("active", !bookingActive);
    dom.stepPillBooking.classList.toggle("active", bookingActive);
  }

  function updateStatusMessage(message, isError) {
    if (!message) {
      dom.statusMessage.hidden = true;
      dom.statusMessage.textContent = "";
      dom.statusMessage.style.color = "";
      return;
    }

    dom.statusMessage.hidden = false;
    dom.statusMessage.textContent = message;
    dom.statusMessage.style.color = isError ? "var(--error)" : "";
  }

  function handleCalendarMessage(event) {
    if (!isAllowedOrigin(event.origin)) {
      return;
    }

    var data = parseMessageData(event.data);
    if (!data) {
      return;
    }

    var nextHeight = extractIframeHeight(data);
    if (nextHeight) {
      dom.bookingFrame.style.minHeight = nextHeight + "px";
      dom.bookingFrame.style.height = "auto";
    }

    if (isBookingCompleteMessage(data)) {
      if (state.bookingCompleted) {
        return;
      }

      state.bookingCompleted = true;
      updateStatusMessage("Booking complete. Sending confirmation...", false);
      pushDataLayer("booking_complete", {
        ghl_contact_id: state.ghlContactId || null,
        session_id: state.sessionId,
        funnel_key: config.funnelKey,
        qualified: state.qualified
      });

      persistEvent("booking_complete", {
        message: data
      }).finally(function () {
        clearDraft();
        redirectToConfirmation();
      });
    }
  }

  function isBookingCompleteMessage(data) {
    if (!data || typeof data !== "object") {
      return false;
    }

    return data.type === "bookingComplete" ||
      data.event === "bookingComplete" ||
      data.message === "bookingComplete";
  }

  function extractIframeHeight(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    if (data.type === "resize" && data.height) {
      return data.height;
    }

    if (data.height) {
      return data.height;
    }

    if (data.event === "calendly.page_height" && data.payload && data.payload.height) {
      return data.payload.height;
    }

    return null;
  }

  function redirectToConfirmation() {
    var destination = "";
    if (config.calendar.confirmationUrl) {
      destination = config.calendar.confirmationUrl;
    } else {
      destination = window.location.origin + (config.calendar.confirmationPath || DEFAULT_CONFIG.calendar.confirmationPath);
    }

    var url = new URL(destination, window.location.href);
    var params = new URLSearchParams(window.location.search);

    params.forEach(function (value, key) {
      url.searchParams.set(key, value);
    });

    if (state.leadId) {
      url.searchParams.set("lead_id", state.leadId);
    }

    url.searchParams.set("session_id", state.sessionId);
    window.location.href = url.toString();
  }

  function renderLegalLinks() {
    if (!config.legalLinks || !config.legalLinks.length) {
      dom.legalLinks.innerHTML = "";
      return;
    }

    dom.legalLinks.innerHTML = config.legalLinks.map(function (link) {
      return '<a href="' + escapeAttribute(link.url) + '" target="_blank" rel="noopener noreferrer">' +
        escapeHtml(link.label) +
        "</a>";
    }).join("");
  }

  function buildSummaryMarkup() {
    var fields = flattenFields().filter(function (field) {
      return !field.excludeFromSummary && state.answers[field.id] != null && state.answers[field.id] !== "" &&
        (!Array.isArray(state.answers[field.id]) || state.answers[field.id].length);
    });

    if (!fields.length) {
      return "";
    }

    var rows = fields.map(function (field) {
      return (
        '<div class="summary-row">' +
        '  <div class="summary-label">' + escapeHtml(field.label || field.id) + "</div>" +
        '  <div class="summary-value">' + escapeHtml(getDisplayValue(field, state.answers[field.id])) + "</div>" +
        "</div>"
      );
    }).join("");

    return (
      '<div class="summary-card">' +
      '  <h4 class="summary-heading">Captured lead data</h4>' +
      '  <div class="summary-list">' + rows + "</div>" +
      "</div>"
    );
  }

  function buildHighlightsMarkup(highlights) {
    if (!highlights || !highlights.length) {
      return "";
    }

    var cards = highlights.map(function (item) {
      return (
        '<div class="highlight-card">' +
        '  <h4 class="highlight-title">' + escapeHtml(item.title) + "</h4>" +
        '  <p class="highlight-copy">' + escapeHtml(item.description || "") + "</p>" +
        "</div>"
      );
    }).join("");

    return '<div class="highlight-grid">' + cards + "</div>";
  }

  function readFieldValue(field) {
    if (field.type === "radio") {
      var selected = dom.panelBody.querySelector('input[name="' + cssEscape(field.id) + '"]:checked');
      return selected ? selected.value : "";
    }

    if (field.type === "checkbox") {
      return Array.prototype.slice.call(dom.panelBody.querySelectorAll('input[name="' + cssEscape(field.id) + '"]:checked')).map(function (input) {
        return input.value;
      });
    }

    var element = dom.panelBody.querySelector('[data-field-id="' + cssEscape(field.id) + '"]');
    return element ? element.value.trim() : "";
  }

  function showFieldError(fieldId, message) {
    var errorEl = document.getElementById("error-" + fieldId);
    if (errorEl) {
      errorEl.textContent = message;
    }

    var field = findFieldById(fieldId);
    if (field.type === "radio" || field.type === "checkbox") {
      Array.prototype.slice.call(dom.panelBody.querySelectorAll('[data-choice-field="' + cssEscape(fieldId) + '"]')).forEach(function (card) {
        card.classList.add("invalid");
      });
      return;
    }

    var input = dom.panelBody.querySelector('[data-field-id="' + cssEscape(fieldId) + '"]');
    if (input) {
      input.classList.add("invalid");
    }
  }

  function clearFieldError(fieldId) {
    var errorEl = document.getElementById("error-" + fieldId);
    if (errorEl) {
      errorEl.textContent = "";
    }

    Array.prototype.slice.call(dom.panelBody.querySelectorAll('[data-choice-field="' + cssEscape(fieldId) + '"]')).forEach(function (card) {
      card.classList.remove("invalid");
    });

    var input = dom.panelBody.querySelector('[data-field-id="' + cssEscape(fieldId) + '"]');
    if (input) {
      input.classList.remove("invalid");
    }
  }

  function updateChoiceCards(fieldId) {
    Array.prototype.slice.call(dom.panelBody.querySelectorAll('[data-choice-field="' + cssEscape(fieldId) + '"]')).forEach(function (card) {
      var input = card.querySelector('input[name="' + cssEscape(fieldId) + '"]');
      card.classList.toggle("checked", !!(input && input.checked));
    });
  }

  function extractLeadFields() {
    var result = {
      full_name: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: ""
    };

    flattenFields().forEach(function (field) {
      var leadField = field.leadField;
      if (leadField && result.hasOwnProperty(leadField)) {
        result[leadField] = state.answers[field.id] || "";
      }
    });

    if (!result.full_name && result.first_name && result.last_name) {
      result.full_name = (result.first_name + " " + result.last_name).trim();
    }

    return result;
  }

  function buildAnswerPayload() {
    return flattenFields().reduce(function (accumulator, field) {
      var value = state.answers[field.id];
      if (value == null || value === "" || (Array.isArray(value) && !value.length)) {
        return accumulator;
      }

      accumulator[field.id] = {
        label: field.label || field.id,
        value: value,
        display_value: getDisplayValue(field, value)
      };
      return accumulator;
    }, {});
  }

  function getDisplayValue(field, value) {
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return getOptionLabel(field, item);
      }).join(", ");
    }

    return getOptionLabel(field, value);
  }

  function getOptionLabel(field, value) {
    if (!field.options || !field.options.length) {
      return String(value);
    }

    var match = field.options.find(function (option) {
      return String(option.value) === String(value);
    });

    return match ? match.label : String(value);
  }

  function flattenFields() {
    return config.steps.reduce(function (items, step) {
      return items.concat(step.fields || []);
    }, []);
  }

  function findFieldById(fieldId) {
    return flattenFields().find(function (field) {
      return field.id === fieldId;
    }) || null;
  }

  function scrollToCalendar() {
    dom.calendarPanel.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function focusFormTop() {
    if (!isPrimaryMobile()) {
      return;
    }

    dom.panelTitle.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function hydrateDraft() {
    var raw = readStorage(storageKeys.draft);
    if (!raw) {
      return;
    }

    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state.answers = parsed.answers || {};
        state.currentStepIndex = Math.max(0, Math.min(parsed.currentStepIndex || 0, Math.max(config.steps.length - 1, 0)));
        state.status = parsed.status || "draft";
        state.qualified = parsed.qualified == null ? null : parsed.qualified;
        state.leadId = parsed.leadId || null;
      }
    } catch (error) {
      console.warn("Draft hydration failed:", error);
    }
  }

  function persistDraft() {
    writeStorage(storageKeys.draft, JSON.stringify({
      answers: state.answers,
      currentStepIndex: state.currentStepIndex,
      status: state.status,
      qualified: state.qualified,
      leadId: state.leadId
    }));
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(storageKeys.draft);
    } catch (error) {
      console.warn("Draft clearing failed:", error);
    }
  }

  function captureTrackingParams() {
    var params = new URLSearchParams(window.location.search);
    (config.trackingKeys || DEFAULT_CONFIG.trackingKeys).forEach(function (key) {
      var value = params.get(key);
      if (!value) {
        return;
      }

      try {
        window.localStorage.setItem("smart-capture:tracking:" + key, value);
      } catch (error) {
        console.warn("Tracking persistence failed for", key, error);
      }

      setCookie(key, value, 30);
    });
  }

  function getTrackingSnapshot() {
    var tracking = {};
    var params = new URLSearchParams(window.location.search);

    (config.trackingKeys || DEFAULT_CONFIG.trackingKeys).forEach(function (key) {
      var value = params.get(key) ||
        readStorage("smart-capture:tracking:" + key) ||
        getCookie(key);

      if (value) {
        tracking[key] = value;
      }
    });

    return tracking;
  }

  function loadEmbedScript() {
    if (!config.calendar.embedScriptUrl) {
      return;
    }

    if (document.querySelector('script[src="' + config.calendar.embedScriptUrl + '"]')) {
      return;
    }

    var script = document.createElement("script");
    script.src = config.calendar.embedScriptUrl;
    script.async = true;
    document.body.appendChild(script);
  }

  function applyTheme() {
    if (!config.theme) {
      return;
    }

    Object.keys(config.theme).forEach(function (key) {
      var cssName = "--" + key.replace(/[A-Z]/g, function (match) {
        return "-" + match.toLowerCase();
      });
      document.documentElement.style.setProperty(cssName, config.theme[key]);
    });
  }

  function isAllowedOrigin(origin) {
    return (config.calendar.allowedMessageOrigins || []).indexOf(origin) !== -1;
  }

  function isPrimaryMobile() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function shouldDeferCalendarEmbed() {
    return false;
  }

  function syncPageState() {
    document.body.setAttribute("data-capture-state", state.status);
    document.body.setAttribute("data-mobile-view", isPrimaryMobile() ? "true" : "false");
  }

  function handleViewportChange() {
    var nextIsMobile = isPrimaryMobile();
    syncPageState();

    if (nextIsMobile === state.isMobileView) {
      return;
    }

    state.isMobileView = nextIsMobile;
    syncCalendarFrame(state.status === "qualified");
  }

  function parseMessageData(data) {
    if (typeof data === "string") {
      try {
        return JSON.parse(data);
      } catch (error) {
        return null;
      }
    }

    if (data && typeof data === "object") {
      return data;
    }

    return null;
  }

  function splitFullName(fullName) {
    var parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) {
      return {
        firstName: "",
        lastName: ""
      };
    }

    return {
      firstName: parts[0] || "",
      lastName: parts.slice(1).join(" ")
    };
  }

  function detectTimezone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (error) {
      return null;
    }
  }

  function getPageUrl() {
    try {
      return window.top !== window ? window.top.location.href : window.location.href;
    } catch (error) {
      return window.location.href;
    }
  }

  function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (character) {
      var random = Math.random() * 16 | 0;
      var value = character === "x" ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  function setCookie(name, value, days) {
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/";
  }

  function getCookie(name) {
    var key = name + "=";
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i += 1) {
      var item = parts[i].trim();
      if (item.indexOf(key) === 0) {
        return decodeURIComponent(item.substring(key.length));
      }
    }
    return "";
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("Local storage write failed:", error);
    }
  }

  function mergeConfig(base, override) {
    var result = Array.isArray(base) ? base.slice() : {};
    var source = override || {};

    Object.keys(base).forEach(function (key) {
      if (isPlainObject(base[key])) {
        result[key] = mergeConfig(base[key], source[key]);
      } else if (Array.isArray(base[key])) {
        result[key] = Array.isArray(source[key]) ? source[key].slice() : base[key].slice();
      } else {
        result[key] = source[key] !== undefined ? source[key] : base[key];
      }
    });

    Object.keys(source).forEach(function (key) {
      if (result[key] !== undefined) {
        return;
      }

      if (Array.isArray(source[key])) {
        result[key] = source[key].slice();
      } else if (isPlainObject(source[key])) {
        result[key] = mergeConfig({}, source[key]);
      } else {
        result[key] = source[key];
      }
    });

    return result;
  }

  function isPlainObject(value) {
    return Object.prototype.toString.call(value) === "[object Object]";
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") {
      return window.CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
  }

  function successIconSvg() {
    return '' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '  <path d="M6 12.5L10 16.5L18.5 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path>' +
      "</svg>";
  }

  function failureIconSvg() {
    return '' +
      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
      '  <path d="M12 8V12.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"></path>' +
      '  <circle cx="12" cy="16.5" r="1.1" fill="currentColor"></circle>' +
      '  <path d="M10.4 4.8L3.9 16.2C3.3 17.3 4.1 18.7 5.4 18.7H18.6C19.9 18.7 20.7 17.3 20.1 16.2L13.6 4.8C12.9 3.6 11.1 3.6 10.4 4.8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path>' +
      "</svg>";
  }
})();
