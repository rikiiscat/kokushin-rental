const API_BASE = "";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error");
  return res.json();
}

// list page
if (document.getElementById("car-container")) {
  (async () => {
    const list = await fetchJSON(`${API_BASE}/api/cars`);
    const container = document.getElementById("car-container");
    container.innerHTML = "";
    list.forEach(car => {
      const card = document.createElement("div");
      card.className = "car-card";
      card.innerHTML = `
        <img src="${car.image || '/photos/placeholder.png'}" alt="${car.name}">
        <h3>${car.name}</h3>
        <p>¥${car.price}/天</p>
        <a href="car-detail.html?id=${car.id}">查看详情</a>
      `;
      container.appendChild(card);
    });
  })();
}

// detail page
// detail page
if (document.getElementById("car-detail")) {
  (async () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const detail = document.getElementById("car-detail");

    if (!id) {
      detail.innerHTML = "<p>未找到车辆信息。</p>";
      return;
    }

    try {
      const car = await fetchJSON(`/api/cars/${id}`);
      detail.innerHTML = `
        <h2>${car.name}</h2>
        <img src="${car.image || '/photos/placeholder.png'}" alt="${car.name}" style="max-width:500px;border-radius:10px;margin:20px 0;">
        <p><strong>价格：</strong>¥${car.price}/天</p>
        <p><strong>描述：</strong>${car.description || '暂无描述'}</p>
        <a href="cars.html" class="btn">返回列表</a>
      `;
    } catch (err) {
      detail.innerHTML = "<p>加载失败，请稍后再试。</p>";
      console.error(err);
    }
  })();
}
