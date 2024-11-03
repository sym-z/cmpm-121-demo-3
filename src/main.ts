// todo
const app = document.querySelector<HTMLDivElement>("#app")!;

const testButton = document.createElement("button");
testButton.textContent = "Click me!";
testButton.addEventListener("click", () => {
  alert("you clicked the button!");
});
app.appendChild(testButton);
