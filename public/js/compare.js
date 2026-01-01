// Compare.js - Laptop Comparison Page Logic

let laptopsData = [];
let visibleBenchmarks = new Set(); // Will be populated with Cinebench benchmarks
let visibleGames = new Set(); // Will show all games by default
let allAvailableBenchmarks = new Set();
let allAvailableGames = new Set();

// Get URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const laptopUrls = [];

  // Extract all laptop URLs (laptop1, laptop2, laptop3, etc.)
  for (let [key, value] of params.entries()) {
    if (key.startsWith('laptop')) {
      laptopUrls.push(decodeURIComponent(value));
    }
  }

  return laptopUrls;
}

// Fetch laptop data and benchmarks from unified API endpoint
async function fetchLaptopData(url) {
  try {
    const response = await fetch('/api/analyze/laptop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch laptop data');
    }

    const result = await response.json();

    if (!result.success || !result.product) {
      throw new Error('Invalid laptop data');
    }

    const product = result.product;
    const benchmarks = result.benchmarks;

    const productName = product.fullName || `${product.brand} ${product.model}` || 'Unknown Laptop';
    const cpuName = product.specifications?.cpu || null;
    const gpuName = product.specifications?.gpu || null;
    const ram = product.specifications?.ram || null;
    const storage = product.specifications?.storage || null;
    const color = product.specifications?.color || null;
    const price = product.price || null;

    // Extract benchmark data
    const cpuBenchmarks = benchmarks?.cpu?.found ? benchmarks.cpu.benchmarks || [] : [];
    const games = benchmarks?.gpu?.found ? benchmarks.gpu.games || [] : [];
    const gpuReviewUrl = benchmarks?.gpu?.reviewUrl || null;
    const cpuReviewUrl = benchmarks?.cpu?.reviewUrl || null;
    const finalGpuName = benchmarks?.gpu?.gpuName || gpuName;

    return {
      productName,
      cpuName,
      gpuName,
      ram,
      storage,
      color,
      price,
      url,
      cpuBenchmarks,
      games,
      gpuReviewUrl,
      cpuReviewUrl,
      finalGpuName
    };
  } catch (error) {
    console.error('Error fetching laptop data:', error);
    return null;
  }
}

// Save data to localStorage
function saveToLocalStorage() {
  try {
    const data = {
      laptopsData,
      visibleBenchmarks: Array.from(visibleBenchmarks),
      visibleGames: Array.from(visibleGames),
      timestamp: Date.now()
    };
    localStorage.setItem('laptopComparison', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

// Load data from localStorage
function loadFromLocalStorage() {
  try {
    const stored = localStorage.getItem('laptopComparison');
    if (stored) {
      const data = JSON.parse(stored);

      // Check if data is not too old (24 hours)
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      if (data.timestamp && data.timestamp > oneDayAgo) {
        laptopsData = data.laptopsData || [];
        visibleBenchmarks = new Set(data.visibleBenchmarks || []);
        visibleGames = new Set(data.visibleGames || []);
        return true;
      }
    }
  } catch (error) {
    console.error('Error loading from localStorage:', error);
  }
  return false;
}

// Clear localStorage
function clearLocalStorage() {
  try {
    localStorage.removeItem('laptopComparison');
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

// Load all laptops
async function loadLaptops() {
  const laptopUrls = getUrlParams();

  // Try to load from localStorage first
  if (laptopUrls.length === 0) {
    const loaded = loadFromLocalStorage();
    if (loaded && laptopsData.length > 0) {
      console.log('Loaded comparison data from cache');
      renderTable();
      return;
    }
    showError('No laptops to compare. Right-click on product links and select "Add to Compare Laptop"');
    return;
  }

  // Check if we already have this data in localStorage
  const loaded = loadFromLocalStorage();
  if (loaded && laptopsData.length > 0) {
    const storedUrls = laptopsData.map(l => l.url).sort().join(',');
    const currentUrls = laptopUrls.sort().join(',');

    if (storedUrls === currentUrls) {
      console.log('Using cached laptop data');
      renderTable();
      return;
    }
  }

  try {
    // Fetch all laptop data (now includes benchmarks)
    const promises = laptopUrls.map(async (url) => {
      const laptopData = await fetchLaptopData(url);
      if (!laptopData) {
        return null;
      }

      return {
        url: laptopData.url,
        name: laptopData.productName || 'Unknown Laptop',
        cpu: laptopData.cpuName,
        gpu: laptopData.gpuName,
        ram: laptopData.ram,
        storage: laptopData.storage,
        color: laptopData.color,
        price: laptopData.price,
        cpuBenchmarks: laptopData.cpuBenchmarks || [],
        games: laptopData.games || [],
        gpuReviewUrl: laptopData.gpuReviewUrl || null,
        cpuReviewUrl: laptopData.cpuReviewUrl || null,
        gpuName: laptopData.finalGpuName || laptopData.gpuName
      };
    });

    laptopsData = (await Promise.all(promises)).filter(laptop => laptop !== null);

    if (laptopsData.length === 0) {
      showError('Failed to load laptop data');
      return;
    }

    // Save to localStorage after successful load
    saveToLocalStorage();
    renderTable();
  } catch (error) {
    console.error('Error loading laptops:', error);
    showError('An error occurred while loading laptop data');
  }
}

// Get FPS color based on value
function getFPSColor(fps) {
  const fpsNum = parseFloat(fps);

  if (fpsNum < 10) {
    // Below 10: Red
    return '#dc3545';
  } else if (fpsNum < 30) {
    // 10-30: Red to Yellow gradient
    const ratio = (fpsNum - 10) / 20;
    const r = 220;
    const g = Math.round(53 + (206 - 53) * ratio); // 53 to 206
    const b = Math.round(69 - 69 * ratio); // 69 to 0
    return `rgb(${r}, ${g}, ${b})`;
  } else if (fpsNum < 60) {
    // 30-60: Yellow to Green gradient
    const ratio = (fpsNum - 30) / 30;
    const r = Math.round(220 - (220 - 40) * ratio); // 220 to 40
    const g = Math.round(206 + (167 - 206) * ratio); // 206 to 167
    const b = Math.round(0 + (69 - 0) * ratio); // 0 to 69
    return `rgb(${r}, ${g}, ${b})`;
  } else if (fpsNum < 90) {
    // 60-90: Green to Blue gradient
    const ratio = (fpsNum - 60) / 30;
    const r = Math.round(40 - 40 * ratio); // 40 to 0
    const g = Math.round(167 - (167 - 123) * ratio); // 167 to 123
    const b = Math.round(69 + (255 - 69) * ratio); // 69 to 255
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // Above 90: Blue
    return '#007bff';
  }
}

// Render comparison table
function renderTable() {
  const container = document.getElementById('content');

  if (laptopsData.length === 0) {
    showError('No data to display');
    return;
  }

  // Collect all unique benchmarks and games
  allAvailableBenchmarks.clear();
  allAvailableGames.clear();

  laptopsData.forEach(laptop => {
    laptop.cpuBenchmarks.forEach(bench => allAvailableBenchmarks.add(bench.name));
    laptop.games.forEach(game => allAvailableGames.add(game.game));
  });

  // Initialize visible benchmarks with specific Cinebench versions if not already set
  if (visibleBenchmarks.size === 0) {
    const defaultBenchmarks = [
      'Cinebench R23',
      'Cinebench R20',
      'Cinebench R15'
    ];

    const excludedBenchmarks = [
      'Power Consumption'
    ];

    let hasAdded = false;
    Array.from(allAvailableBenchmarks).forEach(benchName => {
      // Check if the benchmark should be excluded
      const shouldExclude = excludedBenchmarks.some(excludedBench =>
        benchName.includes(excludedBench)
      );

      if (shouldExclude) {
        return; // Skip this benchmark
      }

      // Check if the benchmark name contains any of the default benchmarks
      const shouldAdd = defaultBenchmarks.some(defaultBench =>
        benchName.includes(defaultBench)
      );

      if (shouldAdd) {
        visibleBenchmarks.add(benchName);
        hasAdded = true;
      }
    });
    if (hasAdded) saveToLocalStorage();
  }

  // Show only top 5 most famous games by default
  if (visibleGames.size === 0) {
    const famousGames = [
      'GTA V',
      'The Witcher 3',
      'Cyberpunk 2077',
      'Counter-Strike 2',
      'Call of Duty Black Ops 6'
    ];

    let hasAdded = false;
    allAvailableGames.forEach(game => {
      if (famousGames.includes(game)) {
        visibleGames.add(game);
        hasAdded = true;
      }
    });
    if (hasAdded) saveToLocalStorage();
  }

  // Build table HTML
  let tableHTML = '<div class="table-wrapper"><table class="comparison-table"><thead><tr>';

  // Header row
  tableHTML += '<th class="sticky-column">Benchmark / Game</th>';
  laptopsData.forEach((laptop, index) => {
    const productLink = laptop.url
      ? `<a href="${laptop.url}" target="_blank" class="product-link" title="View product page">${laptop.name}</a>`
      : laptop.name;

    tableHTML += `
      <th>
        <button class="delete-laptop-btn" onclick="deleteLaptop(${index})" title="Remove this laptop">×</button>
        <div class="laptop-name">${productLink}</div>
      </th>
    `;
  });

  // Add column for adding new laptop
  tableHTML += `
    <th class="add-laptop-column">
      <div class="add-laptop-container">
        <input type="text" id="new-laptop-url" class="new-laptop-input" placeholder="Paste product URL...">
        <button class="btn-analyze" onclick="addNewLaptop()">Analyze</button>
      </div>
    </th>
  `;

  tableHTML += '</tr></thead><tbody>';

  // Specifications Section
  tableHTML += `<tr><td colspan="${laptopsData.length + 2}" class="category-header">Specifications</td></tr>`;

  // CPU Row
  tableHTML += '<tr><td class="sticky-column spec-label">CPU</td>';
  laptopsData.forEach(laptop => {
    const cpuLink = laptop.cpuReviewUrl
      ? `<a href="${laptop.cpuReviewUrl}" target="_blank" class="spec-link" title="View CPU review">${laptop.cpu || '-'}</a>`
      : (laptop.cpu || '-');
    tableHTML += `<td class="spec-value">${cpuLink}</td>`;
  });
  tableHTML += '<td class="add-laptop-cell"></td></tr>';

  // GPU Row
  tableHTML += '<tr><td class="sticky-column spec-label">GPU</td>';
  laptopsData.forEach(laptop => {
    const gpuText = laptop.gpuName || laptop.gpu || '-';
    const gpuLink = laptop.gpuReviewUrl
      ? `<a href="${laptop.gpuReviewUrl}" target="_blank" class="spec-link" title="View GPU review">${gpuText}</a>`
      : gpuText;
    tableHTML += `<td class="spec-value">${gpuLink}</td>`;
  });
  tableHTML += '<td class="add-laptop-cell"></td></tr>';

  // RAM Row
  tableHTML += '<tr><td class="sticky-column spec-label">RAM</td>';
  laptopsData.forEach(laptop => {
    tableHTML += `<td class="spec-value">${laptop.ram || '-'}</td>`;
  });
  tableHTML += '<td class="add-laptop-cell"></td></tr>';

  // Storage Row
  tableHTML += '<tr><td class="sticky-column spec-label">Storage</td>';
  laptopsData.forEach(laptop => {
    tableHTML += `<td class="spec-value">${laptop.storage || '-'}</td>`;
  });
  tableHTML += '<td class="add-laptop-cell"></td></tr>';

  // Color Row
  tableHTML += '<tr><td class="sticky-column spec-label">Color</td>';
  laptopsData.forEach(laptop => {
    tableHTML += `<td class="spec-value">${laptop.color || '-'}</td>`;
  });
  tableHTML += '<td class="add-laptop-cell"></td></tr>';

  // Price Row
  tableHTML += '<tr><td class="sticky-column spec-label">Price</td>';
  laptopsData.forEach(laptop => {
    tableHTML += `<td class="spec-value price-value">${laptop.price || '-'}</td>`;
  });
  tableHTML += '<td class="add-laptop-cell"></td></tr>';

  // CPU Benchmarks Section (filtered)
  const visibleBenchmarksList = Array.from(visibleBenchmarks).filter(b => allAvailableBenchmarks.has(b));
  if (visibleBenchmarksList.length > 0 || allAvailableBenchmarks.size > 0) {
    tableHTML += `<tr><td colspan="${laptopsData.length + 2}" class="category-header">CPU Benchmarks</td></tr>`;

    visibleBenchmarksList.forEach(benchName => {
      tableHTML += `<tr><td class="sticky-column benchmark-name">
        ${benchName}
        <button class="remove-btn-inline" onclick="removeBenchmark('${benchName.replace(/'/g, "\\'")}')">×</button>
      </td>`;

      laptopsData.forEach(laptop => {
        const bench = laptop.cpuBenchmarks.find(b => b.name === benchName);
        const score = bench?.score?.avg || bench?.score?.median || bench?.score?.max;

        if (score) {
          tableHTML += `<td class="score-value">${Math.round(score)}</td>`;
        } else {
          tableHTML += '<td class="score-missing">-</td>';
        }
      });

      // Empty cell for add laptop column
      tableHTML += '<td class="add-laptop-cell"></td>';

      tableHTML += '</tr>';
    });

    // Add benchmark control row
    tableHTML += `
      <tr class="add-row">
        <td class="sticky-column" colspan="${laptopsData.length + 2}">
          <div class="add-control-inline">
            <div class="autocomplete-wrapper">
              <input type="text" id="benchmark-search" class="autocomplete-input-inline" placeholder="Search or select benchmark...">
              <button class="dropdown-toggle" onclick="toggleBenchmarkDropdown()" title="Show all benchmarks">▼</button>
            </div>
            <button class="btn-add-inline" onclick="addBenchmark()">+</button>
          </div>
          <div id="benchmark-suggestions" class="suggestions-inline"></div>
        </td>
      </tr>
    `;
  }

  // Gaming Performance Section (filtered)
  const visibleGamesList = Array.from(visibleGames).filter(g => allAvailableGames.has(g));
  if (visibleGamesList.length > 0 || allAvailableGames.size > 0) {
    tableHTML += `<tr><td colspan="${laptopsData.length + 2}" class="category-header">Gaming Performance (FPS)</td></tr>`;

    const settings = ['low', 'medium', 'high', 'ultra', 'qhd', '4k'];

    visibleGamesList.forEach((gameName) => {
      tableHTML += `<tr><td class="sticky-column benchmark-name">
        ${gameName}
        <button class="remove-btn-inline" onclick="removeGame('${gameName.replace(/'/g, "\\'")}')">×</button>
      </td>`;

      laptopsData.forEach(laptop => {
        const game = laptop.games.find(g => g.game === gameName);

        let fpsDisplay = '<div class="game-settings">';
        settings.forEach(setting => {
          // Shorten labels: Low->L, Medium->M, High->H
          let settingLabel;
          if (setting === 'low') settingLabel = 'L';
          else if (setting === 'medium') settingLabel = 'M';
          else if (setting === 'high') settingLabel = 'H';
          else if (setting === 'ultra') settingLabel = 'U';
          else if (setting === 'qhd') settingLabel = 'QHD';
          else if (setting === '4k') settingLabel = '4K';

          const fps = game?.[setting];

          if (fps) {
            const fpsColor = getFPSColor(fps);
            fpsDisplay += `<span class="setting-item"><strong>${settingLabel}:</strong> <span class="fps-value" style="color: ${fpsColor};">${fps}</span></span>`;
          }
        });
        fpsDisplay += '</div>';

        if (game && (game.low || game.medium || game.high || game.ultra || game.qhd || game['4k'])) {
          tableHTML += `<td class="score-value">${fpsDisplay}</td>`;
        } else {
          tableHTML += '<td class="score-missing">-</td>';
        }
      });

      // Empty cell for add laptop column
      tableHTML += '<td class="add-laptop-cell"></td>';

      tableHTML += '</tr>';
    });

    // Add game control row
    tableHTML += `
      <tr class="add-row">
        <td class="sticky-column" colspan="${laptopsData.length + 2}">
          <div class="add-control-inline">
            <div class="autocomplete-wrapper">
              <input type="text" id="game-search" class="autocomplete-input-inline" placeholder="Search or select game...">
              <button class="dropdown-toggle" onclick="toggleGameDropdown()" title="Show all games">▼</button>
            </div>
            <button class="btn-add-inline" onclick="addGame()">+</button>
          </div>
          <div id="game-suggestions" class="suggestions-inline"></div>
        </td>
      </tr>
    `;
  }

  tableHTML += '</tbody></table></div>';

  container.innerHTML = tableHTML;

  // Setup autocomplete
  setupAutocomplete();

  // Setup enter key for add laptop input
  const newLaptopInput = document.getElementById('new-laptop-url');
  if (newLaptopInput) {
    newLaptopInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addNewLaptop();
      }
    });
  }
}

// Position suggestions dropdown
function positionSuggestions(inputElement, suggestionsElement) {
  const rect = inputElement.getBoundingClientRect();
  suggestionsElement.style.top = `${rect.bottom + 2}px`;
  suggestionsElement.style.left = `${rect.left}px`;
  suggestionsElement.style.width = `${rect.width}px`;
}

// Setup autocomplete for benchmark and game search
function setupAutocomplete() {
  const benchmarkInput = document.getElementById('benchmark-search');
  const gameInput = document.getElementById('game-search');
  const benchmarkSuggestions = document.getElementById('benchmark-suggestions');
  const gameSuggestions = document.getElementById('game-suggestions');

  if (!benchmarkInput || !gameInput) return;

  // Benchmark autocomplete
  if (benchmarkInput) {
    benchmarkInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();

      let matches;
      if (query.length === 0) {
        // Show all available benchmarks when no search query
        matches = Array.from(allAvailableBenchmarks)
          .filter(b => !visibleBenchmarks.has(b))
          .sort();
      } else {
        // Filter by search query
        matches = Array.from(allAvailableBenchmarks)
          .filter(b => !visibleBenchmarks.has(b) && b.toLowerCase().includes(query))
          .sort();
      }

      if (matches.length > 0) {
        const displayMatches = matches.slice(0, 10); // Show max 10 items
        benchmarkSuggestions.innerHTML = displayMatches.map(b =>
          `<div class="suggestion-item" onclick="selectBenchmark('${b.replace(/'/g, "\\'")}')">${b}</div>`
        ).join('');
        benchmarkSuggestions.style.display = 'block';
        positionSuggestions(benchmarkInput, benchmarkSuggestions);
      } else {
        benchmarkSuggestions.innerHTML = '<div class="suggestion-item no-results">No benchmarks found</div>';
        benchmarkSuggestions.style.display = 'block';
        positionSuggestions(benchmarkInput, benchmarkSuggestions);
      }
    });

    benchmarkInput.addEventListener('focus', () => {
      // Show all available benchmarks on focus
      const matches = Array.from(allAvailableBenchmarks)
        .filter(b => !visibleBenchmarks.has(b))
        .sort()
        .slice(0, 10);

      if (matches.length > 0) {
        benchmarkSuggestions.innerHTML = matches.map(b =>
          `<div class="suggestion-item" onclick="selectBenchmark('${b.replace(/'/g, "\\'")}')">${b}</div>`
        ).join('');
        benchmarkSuggestions.style.display = 'block';
        positionSuggestions(benchmarkInput, benchmarkSuggestions);
      }
    });

    benchmarkInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addBenchmark();
      }
    });
  }

  // Game autocomplete
  if (gameInput) {
    gameInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();

      let matches;
      if (query.length === 0) {
        // Show all available games when no search query
        matches = Array.from(allAvailableGames)
          .filter(g => !visibleGames.has(g))
          .sort();
      } else {
        // Filter by search query
        matches = Array.from(allAvailableGames)
          .filter(g => !visibleGames.has(g) && g.toLowerCase().includes(query))
          .sort();
      }

      if (matches.length > 0) {
        const displayMatches = matches.slice(0, 10); // Show max 10 items
        gameSuggestions.innerHTML = displayMatches.map(g =>
          `<div class="suggestion-item" onclick="selectGame('${g.replace(/'/g, "\\'")}')">${g}</div>`
        ).join('');
        gameSuggestions.style.display = 'block';
        positionSuggestions(gameInput, gameSuggestions);
      } else {
        gameSuggestions.innerHTML = '<div class="suggestion-item no-results">No games found</div>';
        gameSuggestions.style.display = 'block';
        positionSuggestions(gameInput, gameSuggestions);
      }
    });

    gameInput.addEventListener('focus', () => {
      // Show all available games on focus
      const matches = Array.from(allAvailableGames)
        .filter(g => !visibleGames.has(g))
        .sort()
        .slice(0, 10);

      if (matches.length > 0) {
        gameSuggestions.innerHTML = matches.map(g =>
          `<div class="suggestion-item" onclick="selectGame('${g.replace(/'/g, "\\'")}')">${g}</div>`
        ).join('');
        gameSuggestions.style.display = 'block';
        positionSuggestions(gameInput, gameSuggestions);
      }
    });

    gameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addGame();
      }
    });
  }

  // Close suggestions when clicking outside
  document.addEventListener('click', (e) => {
    const benchmarkWrapper = benchmarkInput?.closest('.autocomplete-wrapper');
    const gameWrapper = gameInput?.closest('.autocomplete-wrapper');

    if (benchmarkWrapper && !benchmarkWrapper.contains(e.target) && !benchmarkSuggestions.contains(e.target)) {
      benchmarkSuggestions.style.display = 'none';
    }
    if (gameWrapper && !gameWrapper.contains(e.target) && !gameSuggestions.contains(e.target)) {
      gameSuggestions.style.display = 'none';
    }
  });
}

// Toggle benchmark dropdown
function toggleBenchmarkDropdown() {
  const benchmarkInput = document.getElementById('benchmark-search');
  const benchmarkSuggestions = document.getElementById('benchmark-suggestions');

  if (!benchmarkInput || !benchmarkSuggestions) return;

  if (benchmarkSuggestions.style.display === 'block') {
    benchmarkSuggestions.style.display = 'none';
  } else {
    // Show all available benchmarks
    const matches = Array.from(allAvailableBenchmarks)
      .filter(b => !visibleBenchmarks.has(b))
      .sort()
      .slice(0, 10);

    if (matches.length > 0) {
      benchmarkSuggestions.innerHTML = matches.map(b =>
        `<div class="suggestion-item" onclick="selectBenchmark('${b.replace(/'/g, "\\'")}')">${b}</div>`
      ).join('');
      benchmarkSuggestions.style.display = 'block';
      positionSuggestions(benchmarkInput, benchmarkSuggestions);
    }
    benchmarkInput.focus();
  }
}

// Toggle game dropdown
function toggleGameDropdown() {
  const gameInput = document.getElementById('game-search');
  const gameSuggestions = document.getElementById('game-suggestions');

  if (!gameInput || !gameSuggestions) return;

  if (gameSuggestions.style.display === 'block') {
    gameSuggestions.style.display = 'none';
  } else {
    // Show all available games
    const matches = Array.from(allAvailableGames)
      .filter(g => !visibleGames.has(g))
      .sort()
      .slice(0, 10);

    if (matches.length > 0) {
      gameSuggestions.innerHTML = matches.map(g =>
        `<div class="suggestion-item" onclick="selectGame('${g.replace(/'/g, "\\'")}')">${g}</div>`
      ).join('');
      gameSuggestions.style.display = 'block';
      positionSuggestions(gameInput, gameSuggestions);
    }
    gameInput.focus();
  }
}

// Select benchmark from suggestions
function selectBenchmark(benchmarkName) {
  visibleBenchmarks.add(benchmarkName);
  const benchmarkInput = document.getElementById('benchmark-search');
  const benchmarkSuggestions = document.getElementById('benchmark-suggestions');
  if (benchmarkInput) benchmarkInput.value = '';
  if (benchmarkSuggestions) benchmarkSuggestions.style.display = 'none';
  saveToLocalStorage();
  renderTable();
}

// Select game from suggestions
function selectGame(gameName) {
  visibleGames.add(gameName);
  const gameInput = document.getElementById('game-search');
  const gameSuggestions = document.getElementById('game-suggestions');
  if (gameInput) gameInput.value = '';
  if (gameSuggestions) gameSuggestions.style.display = 'none';
  saveToLocalStorage();
  renderTable();
}

// Add benchmark
function addBenchmark() {
  const input = document.getElementById('benchmark-search');
  const suggestions = document.getElementById('benchmark-suggestions');
  const value = input.value.trim();

  if (value) {
    // Try exact match first
    const exactMatch = Array.from(allAvailableBenchmarks).find(b =>
      b.toLowerCase() === value.toLowerCase()
    );

    if (exactMatch) {
      visibleBenchmarks.add(exactMatch);
      input.value = '';
      if (suggestions) suggestions.style.display = 'none';
      saveToLocalStorage();
      renderTable();
    } else {
      alert('Benchmark not found. Please select from suggestions.');
    }
  }
}

// Add game
function addGame() {
  const input = document.getElementById('game-search');
  const suggestions = document.getElementById('game-suggestions');
  const value = input.value.trim();

  if (value) {
    // Try exact match first
    const exactMatch = Array.from(allAvailableGames).find(g =>
      g.toLowerCase() === value.toLowerCase()
    );

    if (exactMatch) {
      visibleGames.add(exactMatch);
      input.value = '';
      if (suggestions) suggestions.style.display = 'none';
      saveToLocalStorage();
      renderTable();
    } else {
      alert('Game not found. Please select from suggestions.');
    }
  }
}

// Remove benchmark
function removeBenchmark(benchmarkName) {
  visibleBenchmarks.delete(benchmarkName);
  saveToLocalStorage();
  renderTable();
}

// Remove game
function removeGame(gameName) {
  visibleGames.delete(gameName);
  saveToLocalStorage();
  renderTable();
}

// Delete laptop
function deleteLaptop(index) {
  if (confirm('Remove this laptop from comparison?')) {
    laptopsData.splice(index, 1);
    saveToLocalStorage();

    if (laptopsData.length === 0) {
      clearLocalStorage();
      showError('No laptops to compare. Add a laptop using the input field or right-click on product links.');
    } else {
      renderTable();
    }
  }
}

// Add new laptop
async function addNewLaptop() {
  const input = document.getElementById('new-laptop-url');
  const url = input.value.trim();

  if (!url) {
    alert('Please enter a product URL');
    return;
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    alert('Invalid URL format');
    return;
  }

  // Check if laptop already exists
  if (laptopsData.some(l => l.url === url)) {
    alert('This laptop is already in the comparison');
    return;
  }

  // Show loading state
  const analyzeBtn = document.querySelector('.btn-analyze');
  const originalText = analyzeBtn.textContent;
  analyzeBtn.textContent = 'Analyzing...';
  analyzeBtn.disabled = true;

  try {
    // Fetch laptop data (now includes benchmarks)
    const laptopData = await fetchLaptopData(url);
    if (!laptopData) {
      alert('Failed to fetch laptop data');
      return;
    }

    const newLaptop = {
      url: laptopData.url,
      name: laptopData.productName || 'Unknown Laptop',
      cpu: laptopData.cpuName,
      gpu: laptopData.gpuName,
      ram: laptopData.ram,
      storage: laptopData.storage,
      color: laptopData.color,
      price: laptopData.price,
      cpuBenchmarks: laptopData.cpuBenchmarks || [],
      games: laptopData.games || [],
      gpuReviewUrl: laptopData.gpuReviewUrl || null,
      cpuReviewUrl: laptopData.cpuReviewUrl || null,
      gpuName: laptopData.finalGpuName || laptopData.gpuName
    };

    laptopsData.push(newLaptop);
    input.value = '';
    saveToLocalStorage();
    renderTable();
  } catch (error) {
    console.error('Error adding laptop:', error);
    alert('An error occurred while analyzing the laptop');
  } finally {
    analyzeBtn.textContent = originalText;
    analyzeBtn.disabled = false;
  }
}

// Show error message
function showError(message) {
  const container = document.getElementById('content');
  container.innerHTML = `
    <div class="error">${message}</div>
    <div class="add-laptop-empty-state">
      <h3>Add a Laptop to Compare</h3>
      <div class="add-laptop-container">
        <input type="text" id="new-laptop-url" class="new-laptop-input" placeholder="Paste product URL...">
        <button class="btn-analyze" onclick="addNewLaptop()">Analyze</button>
      </div>
    </div>
  `;

  // Setup enter key for add laptop input in empty state
  const newLaptopInput = document.getElementById('new-laptop-url');
  if (newLaptopInput) {
    newLaptopInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addNewLaptop();
      }
    });
  }
}

// Clear comparison
function clearComparison() {
  if (confirm('Clear all laptops from comparison?')) {
    clearLocalStorage();
    window.location.href = '/compare';
  }
}

// Export to CSV
function exportToCSV() {
  if (laptopsData.length === 0) {
    alert('No data to export');
    return;
  }

  let csv = 'Benchmark/Game';
  laptopsData.forEach(laptop => {
    csv += ',' + laptop.name.replace(/,/g, ';');
  });
  csv += '\n';

  // Add visible CPU Benchmarks only
  const visibleBenchmarksList = Array.from(visibleBenchmarks).filter(b => allAvailableBenchmarks.has(b));
  visibleBenchmarksList.forEach(benchName => {
    csv += benchName.replace(/,/g, ';');
    laptopsData.forEach(laptop => {
      const bench = laptop.cpuBenchmarks.find(b => b.name === benchName);
      const score = bench?.score?.avg || bench?.score?.median || bench?.score?.max;
      csv += ',' + (score ? Math.round(score) : '-');
    });
    csv += '\n';
  });

  // Add visible Gaming Performance only (grouped by game)
  const visibleGamesList = Array.from(visibleGames).filter(g => allAvailableGames.has(g));
  const settings = ['low', 'medium', 'high', 'ultra', 'qhd', '4k'];
  visibleGamesList.forEach(gameName => {
    csv += gameName.replace(/,/g, ';');
    laptopsData.forEach(laptop => {
      const game = laptop.games.find(g => g.game === gameName);
      let fpsValues = [];
      settings.forEach(setting => {
        // Shorten labels: Low->L, Medium->M, High->H
        let settingLabel;
        if (setting === 'low') settingLabel = 'L';
        else if (setting === 'medium') settingLabel = 'M';
        else if (setting === 'high') settingLabel = 'H';
        else if (setting === 'ultra') settingLabel = 'U';
        else if (setting === 'qhd') settingLabel = 'QHD';
        else if (setting === '4k') settingLabel = '4K';

        const fps = game?.[setting];
        if (fps) {
          fpsValues.push(`${settingLabel}: ${fps}`);
        }
      });
      csv += ',' + (fpsValues.length > 0 ? fpsValues.join('; ') : '-');
    });
    csv += '\n';
  });

  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laptop-comparison-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialize
document.addEventListener('DOMContentLoaded', loadLaptops);
