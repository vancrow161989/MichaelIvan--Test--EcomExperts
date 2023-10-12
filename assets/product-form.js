if (!customElements.get("product-form")) {
  customElements.define(
    "product-form",
    class ProductForm extends HTMLElement {
      constructor() {
        super();
        this.Admin_API_KEY = "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";
        this.form = this.querySelector("form");
        this.form.querySelector("[name=id]").disabled = false;
        this.form.addEventListener("submit", this.onSubmitHandler.bind(this));
        this.cart =
          document.querySelector("cart-notification") ||
          document.querySelector("cart-drawer");
        this.submitButton = this.querySelector('[type="submit"]');

        if (document.querySelector("cart-drawer"))
          this.submitButton.setAttribute("aria-haspopup", "dialog");

        this.hideErrors = this.dataset.hideErrors === "true";
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute("aria-disabled") === "true") return;

        this.handleErrorMessage();

        this.submitButton.setAttribute("aria-disabled", true);
        this.submitButton.classList.add("loading");
        this.querySelector(".loading-overlay__spinner").classList.remove(
          "hidden"
        );

        const config = fetchConfig("javascript");
        config.headers["X-Requested-With"] = "XMLHttpRequest";
        delete config.headers["Content-Type"];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            "sections",
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append("sections_url", window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        /* Starts custom code  for auto adding of product when black and medium is added */
        const bundleId = formData.get("product-bundle");
        const bundleColor = formData.get("Color");
        const bundleSize = formData.get("Size");
        const shouldAddBundle =
          bundleId && bundleColor === "Black" && bundleSize === "Medium";

        console.log("config", config);
        console.log("currentForm", this.form);
        console.log("formData", formData.get("id"));
        for (const entry of formData.entries()) {
          const [name, value] = entry;
          console.log(`Field name: ${name},  Field value: ${value}`);
        }

        if (shouldAddBundle) {
          // bundleAddedData.append('quantity', bundleQty); // Replace '1' with the actual quantity you want
          // bundleAddedData.append('id', bundleId);
          // bundleAddedData.append('product-id', bundleId);
          // bundleAddedData.append('form_type', "product");
          // console.log("bundleId", bundleId);
          // console.log("bundleQuantity", bundleQty);

          fetch(`/admin/api/2023-07/products/${bundleId}.json`, {
            method: "GET",
            headers: {
              "X-Shopify-Access-Token": this.Admin_API_KEY
            }
          })
            .then((response) => response.json())
            .then((data) => {
              const bundleQty = Number(formData.get("quantity"));
              const bundleAddedData = {
                items: [
                  {
                    id: data.product.variants[0].id,
                    "product-id": bundleId,
                    quantity: bundleQty,
                    price: 0.01,
                    line_price: 0.01
                  }
                ]
              };

              const bundleConfig = {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify(bundleAddedData)
              };

              console.log("this variant", data.product.variants[0].id);
              console.log("new data", bundleAddedData);
              fetch(`${routes.cart_add_url}`, bundleConfig)
                .then((response) => console.log("response", response))
                .catch((error) => {
                  console.error("Error:", error);
                });
            })
            .catch((error) => console.log(error));
        }
        /* Ends custom code */

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: "product-form",
                productVariantId: formData.get("id"),
                errors: response.errors || response.description,
                message: response.message
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage =
                this.submitButton.querySelector(".sold-out-message");
              if (!soldOutMessage) return;
              this.submitButton.setAttribute("aria-disabled", true);
              this.submitButton.querySelector("span").classList.add("hidden");
              soldOutMessage.classList.remove("hidden");
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: "product-form",
                productVariantId: formData.get("id"),
                cartData: response
              });
            this.error = false;
            const quickAddModal = this.closest("quick-add-modal");
            if (quickAddModal) {
              document.body.addEventListener(
                "modalClosed",
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              this.cart.renderContents(response);
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove("loading");
            if (this.cart && this.cart.classList.contains("is-empty"))
              this.cart.classList.remove("is-empty");
            if (!this.error) this.submitButton.removeAttribute("aria-disabled");
            this.querySelector(".loading-overlay__spinner").classList.add(
              "hidden"
            );
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper ||
          this.querySelector(".product-form__error-message-wrapper");
        if (!this.errorMessageWrapper) return;
        this.errorMessage =
          this.errorMessage ||
          this.errorMessageWrapper.querySelector(
            ".product-form__error-message"
          );

        this.errorMessageWrapper.toggleAttribute("hidden", !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }
    }
  );
}
