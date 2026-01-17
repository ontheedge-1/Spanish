export function renderFlashcards(cards, root) {
  root.innerHTML = "";
  cards.forEach(c => {
    const div = document.createElement("div");
    div.innerHTML = `<strong>${c.front}</strong> → ${c.back}`;
    root.append(div);
  });
}
