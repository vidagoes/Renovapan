(function () {
  const form = document.getElementById("quote-form");
  const success = document.getElementById("form-success");
  const newRequest = document.getElementById("new-request");
  const equipment = new URLSearchParams(window.location.search).get("equipamento");

  if (equipment) {
    const select = form.elements.equipamento;
    const category = window.RENOVAPAN_DATA.products.find((product) => product.name === equipment)?.category;
    const matchingOption = [...select.options].find((option) => option.text === category?.replace(/s$/, ""));
    if (matchingOption) select.value = matchingOption.value;
    form.elements.mensagem.value = `Tenho interesse no equipamento demonstrativo: ${equipment}. Gostaria de receber mais informações.`;
  }

  form.elements.telefone.addEventListener("input", (event) => {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      event.target.value = digits.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => `(${a}${b ? ") " + b : ""}${c ? "-" + c : ""}`);
    } else {
      event.target.value = digits.replace(/(\d{2})(\d{0,5})(\d{0,4})/, (_, a, b, c) => `(${a}) ${b}${c ? "-" + c : ""}`);
    }
  });

  function validateField(field) {
    const wrapper = field.closest(".form-field") || field.closest(".form-check");
    let message = "";
    if (field.validity.valueMissing) message = field.type === "checkbox" ? "Confirme para continuar." : "Este campo é obrigatório.";
    else if (field.validity.typeMismatch) message = "Informe um e-mail válido.";
    else if (field.validity.tooShort) message = `Digite pelo menos ${field.minLength} caracteres.`;
    else if (field.name === "telefone" && field.value.replace(/\D/g, "").length < 10) message = "Informe um telefone com DDD.";
    wrapper.classList.toggle("is-error", Boolean(message));
    const small = wrapper.querySelector("small");
    if (small) small.textContent = message;
    return !message;
  }

  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("blur", () => validateField(field));
    field.addEventListener("change", () => validateField(field));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fields = [...form.querySelectorAll("input, select, textarea")];
    const valid = fields.map(validateField).every(Boolean);
    if (!valid) {
      form.querySelector(".is-error input, .is-error select, .is-error textarea")?.focus();
      return;
    }
    form.hidden = true;
    success.hidden = false;
    success.querySelector("h2").focus?.();
  });

  newRequest.addEventListener("click", () => {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    form.querySelectorAll(".is-error").forEach((item) => item.classList.remove("is-error"));
    form.elements.nome.focus();
  });
})();
