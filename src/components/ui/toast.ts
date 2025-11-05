"use client";

// Minimal, dependency-free toast that uses native HTML elements.
// Creates a top-right stack and auto-dismisses items.

export type ToastOptions = {
	variant?: "default" | "success" | "error";
	duration?: number; // ms
};

const ensureContainer = () => {
	let el = document.getElementById("toast-root");
	if (!el) {
		el = document.createElement("div");
		el.id = "toast-root";
		el.className = [
			"pointer-events-none",
			"fixed",
			"top-4",
			"right-4",
			"z-[1000]",
			"flex",
			"flex-col",
			"gap-2",
		].join(" ");
		document.body.appendChild(el);
	}
	return el;
};

export function showToast(message: string, opts: ToastOptions = {}) {
	const { variant = "default", duration = 2500 } = opts;
	if (typeof window === "undefined") return;
	const root = ensureContainer();

	const item = document.createElement("div");
	item.setAttribute("role", "status");
	item.setAttribute("aria-live", "polite");

	const base =
		"pointer-events-auto select-none rounded-md border px-3 py-2 text-sm shadow-md transition-opacity duration-200 bg-white border-gray-200 text-gray-900";
	const success = "border-green-200 bg-green-50";
	const error = "border-red-200 bg-red-50";

	item.className = [
		base,
		variant === "success" ? success : variant === "error" ? error : "",
		"opacity-0",
	].join(" ");
	item.textContent = message;
	root.appendChild(item);

	// Fade in
	requestAnimationFrame(() => {
		item.classList.remove("opacity-0");
		item.classList.add("opacity-100");
	});

	const remove = () => {
		item.classList.remove("opacity-100");
		item.classList.add("opacity-0");
		setTimeout(() => {
			item.remove();
		}, 200);
	};

	setTimeout(remove, duration);

	return remove;
}
