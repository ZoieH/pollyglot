const translationForm = document.getElementById("translationForm");
const translationOutput = document.getElementById("translationOutput");
const originalOutput = document.getElementById("originalOutput");
const resetButton = document.getElementById("resetButton");
const brand = document.querySelector(".brand");
const loadingTemplate = document.getElementById("loadingTemplate");

const STORAGE_KEY = "pollyglot-openai-key";
const DEFAULT_PROMPT = "How are you?";

document.addEventListener("DOMContentLoaded", () => {
  const savedText = localStorage.getItem("pollyglot-last-text");
  if (savedText) {
    document.getElementById("sourceText").value = savedText;
    originalOutput.textContent = savedText;
  } else {
    originalOutput.textContent = DEFAULT_PROMPT;
  }

  const savedLanguage = localStorage.getItem("pollyglot-last-language");
  if (savedLanguage) {
    const radio = translationForm.querySelector(`input[value="${savedLanguage}"]`);
    if (radio) radio.checked = true;
  }
});

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

function setApiKey(key) {
  if (key) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function promptForApiKey() {
  const current = getApiKey();
  const masked = current ? `${current.slice(0, 4)}${"*".repeat(Math.max(current.length - 4, 0))}` : "";
  const input = prompt("Enter your OpenAI API key. Leave blank to clear it.", masked);

  if (input === null) {
    return current || "";
  }

  const trimmed = input.trim();

  if (!trimmed) {
    setApiKey("");
    alert("API key cleared.");
    return "";
  }

  if (!/^sk-/.test(trimmed)) {
    const shouldSave = confirm("The key you entered doesn't look like an OpenAI key (sk-...). Save it anyway?");
    if (!shouldSave) {
      return "";
    }
  }

  setApiKey(trimmed);
  alert("API key saved locally for this browser.");
  return trimmed;
}

function withLoading(button, isLoading) {
  if (isLoading) {
    if (!button.dataset.originalLabel) {
      button.dataset.originalLabel = button.innerHTML;
    }
    const fragment = loadingTemplate.content.cloneNode(true);
    const nodes = Array.from(fragment.childNodes);
    button.replaceChildren(...nodes);
    button.disabled = true;
  } else {
    if (button.dataset.originalLabel) {
      button.innerHTML = button.dataset.originalLabel;
      delete button.dataset.originalLabel;
    }
    button.disabled = false;
  }
}

async function callOpenAI({ text, language, apiKey }) {
  if (!apiKey) {
    throw new Error("Missing OpenAI API key.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "user", content: `Desired language: ${language}` },
        {
          role: "user",
          content: `Text to translate: """${text}"""\nPlease respond only with the translation in ${language}.`,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    const message = errorPayload?.error?.message || response.statusText;
    throw new Error(message || "Unable to translate. Try again later.");
  }

  const data = await response.json();
  const result = data?.choices?.[0]?.message?.content;

  if (!result) {
    throw new Error("OpenAI response was empty. Please try again.");
  }

  return result.trim();
}

translationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(translationForm);
  const sourceText = formData.get("source")?.toString().trim();
  const language = formData.get("language")?.toString() ?? "French";

  if (!sourceText) {
    translationOutput.value = "";
    originalOutput.textContent = DEFAULT_PROMPT;
    return;
  }

  localStorage.setItem("pollyglot-last-text", sourceText);
  localStorage.setItem("pollyglot-last-language", language);

  originalOutput.textContent = sourceText;
  translationOutput.value = "";

  const submitButton = translationForm.querySelector("button[type='submit']");
  withLoading(submitButton, true);

  try {
    let apiKey = getApiKey();
    if (!apiKey) {
      apiKey = promptForApiKey();
    }

    if (!apiKey) {
      translationOutput.value = "⚠️ An OpenAI API key is required to translate.";
      return;
    }

    const translation = await callOpenAI({ text: sourceText, language, apiKey });
    translationOutput.value = translation;
  } catch (error) {
    console.error(error);
    translationOutput.value = `⚠️ ${error.message}`;
  } finally {
    withLoading(submitButton, false);
  }
});

resetButton.addEventListener("click", () => {
  translationForm.reset();
  localStorage.removeItem("pollyglot-last-text");
  localStorage.removeItem("pollyglot-last-language");
  originalOutput.textContent = DEFAULT_PROMPT;
  translationOutput.value = "";
});

if (brand) {
  brand.addEventListener("dblclick", () => {
    promptForApiKey();
  });
}
