import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import * as cheerio from 'cheerio';

// Load environment variables
dotenv.config();

let genAI = null;

function getGeminiClient() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    console.log('Initializing Gemini API client');
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

/**
 * Extract clean GPU name from text that may contain extra information
 * Handles Intel, NVIDIA, and AMD GPUs
 */
export function extractCleanGpuName(gpuText) {
  if (!gpuText || typeof gpuText !== 'string') {
    return null;
  }

  // Remove extra whitespace and normalize
  let cleanText = gpuText.trim().replace(/\s+/g, ' ');

  // Common patterns for GPU names
  const patterns = [
    // NVIDIA patterns
    /(?:NVIDIA\s+)?GeForce\s+(?:RTX|GTX|GT|MX)\s+\d+(?:\s+(?:Ti|SUPER|Max-Q))?/gi,
    /(?:NVIDIA\s+)?(?:RTX|GTX)\s+\d+(?:\s+(?:Ti|SUPER|Max-Q))?/gi,
    /NVIDIA\s+Quadro\s+[\w\s]+/gi,
    /NVIDIA\s+Tesla\s+[\w\s]+/gi,

    // AMD patterns
    /AMD\s+Radeon\s+(?:RX|R\d+|Pro)\s+[\w\s]+/gi,
    /Radeon\s+(?:RX|R\d+|Pro)\s+[\w\s]+/gi,
    /AMD\s+Radeon\s+Vega\s+\d+/gi,
    /Radeon\s+Vega\s+\d+/gi,

    // Intel integrated patterns
    /Intel\s+(?:Iris\s+)?(?:Xe|Plus|Pro)\s+Graphics\s+[\w\s\d]+/gi,
    /Intel\s+UHD\s+Graphics\s+\d+/gi,
    /Intel\s+HD\s+Graphics\s+\d+/gi,
    /Intel\s+Iris\s+Graphics\s+\d+/gi,
    /Intel\s+Arc\s+[\w\s]+/gi
  ];

  // Try each pattern
  for (const pattern of patterns) {
    const match = cleanText.match(pattern);
    if (match) {
      let gpuName = match[0].trim();

      // Clean up common suffixes/prefixes
      gpuName = gpuName
        .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content
        .replace(/\s*\[.*?\]\s*/g, '') // Remove bracket content
        .replace(/\s+with\s+.*/gi, '') // Remove "with ..." text
        .replace(/\s*-\s*\d+\s*(?:GB|MHz|GHz).*/gi, '') // Remove specs like "- 8GB"
        .replace(/\s*@\s*[\d.]+\s*(?:MHz|GHz).*/gi, '') // Remove clock speeds
        .replace(/\s+[\d.]+\s*-\s*[\d.]+\s*(?:MHz|GHz).*/gi, '') // Remove frequency ranges
        .trim();

      console.log(`GPU name extracted: "${gpuName}" from "${gpuText}"`);
      return gpuName;
    }
  }

  // Fallback: Try to extract any text containing key GPU brands
  const brandPattern = /(NVIDIA|AMD|Intel|Radeon|GeForce|GTX|RTX|Iris|UHD|HD\s+Graphics|Arc)[\w\s\d]*/gi;
  const brandMatch = cleanText.match(brandPattern);

  if (brandMatch) {
    let gpuName = brandMatch[0].trim();

    // Clean up
    gpuName = gpuName
      .replace(/\s*\(.*?\)\s*/g, '')
      .replace(/\s*\[.*?\]\s*/g, '')
      .replace(/\s+with\s+.*/gi, '')
      .replace(/\s*-\s*\d+\s*(?:GB|MHz|GHz).*/gi, '')
      .replace(/\s*@\s*[\d.]+\s*(?:MHz|GHz).*/gi, '')
      .trim();

    // Limit length to reasonable GPU name
    if (gpuName.length > 60) {
      gpuName = gpuName.substring(0, 60).trim();
    }

    console.log(`GPU name extracted (fallback): "${gpuName}" from "${gpuText}"`);
    return gpuName;
  }

  console.log(`Could not extract GPU name from: "${gpuText}"`);
  return cleanText; // Return original if no pattern matches
}

export async function analyzeProductURL(url) {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Analyze this product URL and extract key information: ${url}

    Please identify:
    1. Product type (laptop, desktop PC, CPU, GPU, or other component)
    2. Brand and model name
    3. Specific model number or SKU if visible in URL
    4. Key specifications if identifiable from URL

    Return the response in JSON format with fields: productType, brand, model, specs.
    Product type should be one of: "laptop", "desktop", "cpu", "gpu", "other"`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Try to parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Fallback: return raw text if JSON parsing fails
    return {
      productType: 'unknown',
      brand: '',
      model: text,
      specs: {}
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to analyze URL with AI');
  }
}

/**
 * Fetch URL and extract DOM class selectors with their text content
 * Only includes classes that appear exactly once in the document
 */
export async function extractClassDataFromURL(url) {
  try {
    console.log(`🔍 Fetching URL for class extraction: ${url}`);

    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Map to track class selectors and their elements
    const classMap = new Map();

    // Traverse all elements with classes
    $('[class]').each((index, element) => {
      const classList = $(element).attr('class');
      if (!classList) return;

      // Build class selector (e.g., ".price.full")
      const classArray = classList.trim().split(/\s+/).filter(c => c);
      if (classArray.length === 0) return;

      const classSelector = '.' + classArray.join('.');

      // Track occurrences of this class selector
      if (!classMap.has(classSelector)) {
        classMap.set(classSelector, {
          count: 0,
          text: null,
          element: element
        });
      }

      const entry = classMap.get(classSelector);
      entry.count++;

      // Store text content only if this is the first occurrence
      if (entry.count === 1) {
        entry.text = $(element).text().trim();
      }
    });

    // Build result object with only unique class selectors
    const result = {};
    let uniqueCount = 0;
    let duplicateCount = 0;

    classMap.forEach((entry, classSelector) => {
      if (entry.count === 1) {
        result[classSelector] = entry.text;
        uniqueCount++;
      } else {
        duplicateCount++;
      }
    });

    console.log(`✅ Extracted ${uniqueCount} unique class selectors (ignored ${duplicateCount} duplicates)`);

    return result;
  } catch (error) {
    console.error('Class extraction error:', error);
    throw new Error('Failed to extract class data from URL');
  }
}

/**
 * Normalize product data to ensure all expected fields exist
 * @param {Object} productData - Raw product data from AI
 * @returns {Object} Normalized product data with all fields
 */
function normalizeProductData(productData) {
  // Default structure matching the expected schema
  const normalized = {
    productType: productData.productType || null,
    fullName: productData.fullName || null,
    brand: productData.brand || null,
    model: productData.model || null,
    price: productData.price || null,
    specifications: {
      cpu: null,
      gpu: null,
      ram: null,
      storage: null,
      color: null,
      screen: null,
      os: null,
      processor_details: {
        cache: null,
        cores: null,
        frequency: null
      },
      keyboard: null,
      connections: [],
      warranty: null
    }
  };

  // Merge specifications if they exist
  if (productData.specifications && typeof productData.specifications === 'object') {
    const specs = productData.specifications;

    normalized.specifications.cpu = specs.cpu || null;
    normalized.specifications.gpu = specs.gpu || null;
    normalized.specifications.ram = specs.ram || null;
    normalized.specifications.storage = specs.storage || null;
    normalized.specifications.color = specs.color || null;
    normalized.specifications.screen = specs.screen || null;
    normalized.specifications.os = specs.os || null;
    normalized.specifications.keyboard = specs.keyboard || null;
    normalized.specifications.warranty = specs.warranty || null;

    // Handle processor_details
    if (specs.processor_details && typeof specs.processor_details === 'object') {
      normalized.specifications.processor_details.cache = specs.processor_details.cache || null;
      normalized.specifications.processor_details.cores = specs.processor_details.cores || null;
      normalized.specifications.processor_details.frequency = specs.processor_details.frequency || null;
    }

    // Handle connections array
    if (Array.isArray(specs.connections) && specs.connections.length > 0) {
      normalized.specifications.connections = specs.connections;
    }
  }

  return normalized;
}

export async function extractProductFromURL(url) {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    const jsonData = await extractClassDataFromURL(url);
    const prompt = `giving this object of data
    ${JSON.stringify(jsonData)}

    Extract detailed product information from the page including:
    1. Product type (laptop, desktop PC, CPU, GPU, RAM, motherboard, etc.)
    2. Complete product name
    3. Brand
    4. Model number
    5. Price (look for price in the page, often in elements with class containing "price")
    6. All technical specifications you can find:
       - CPU/Processor (exact model with details)
       - GPU/Graphics Card (exact model)
       - RAM (e.g., "4 Go DDR4-3200 MHz", "16 GB DDR5")
       - Storage (e.g., "256 Go SSD", "512 GB SSD")
       - Color (e.g., "Noir", "Silver", "Black")
       - Screen (e.g., "15.6\\" HD", "14\\" FHD")
       - OS/Operating System (e.g., "FreeDos", "Windows 11")
       - Processor details (cache, cores, frequency)
       - Keyboard layout/type
       - Connections/Ports (USB, HDMI, etc.)
       - Warranty information

    IMPORTANT RULES:
    - When parsing processor, keep the full Intel/AMD model name (e.g., "Intel® N100", "AMD Ryzen 7 5825U")
    - For generic integrated GPUs like "Intel UHD Graphics", "Intel Iris Xe Graphics", "AMD Radeon Graphics", KEEP them in the response
    - Extract processor details separately: cache, cores, frequency ranges
    - List all connections/ports as an array
    - Include warranty information if available
    - If a field is not found, omit it from the response (don't include it with empty string)

    Return ONLY valid JSON with this EXACT structure:
    {
      "productType": "laptop",
      "fullName": "PC Portable HP 15-fd0421nk Intel N100 4Go 256Go SSD - Noir",
      "brand": "HP",
      "model": "15-fd0421nk",
      "price": "799,000 DT",
      "specifications": {
        "cpu": "Intel® N100",
        "gpu": "Intel UHD Graphics",
        "ram": "4 Go DDR4-3200 MHz",
        "storage": "256 Go SSD",
        "color": "Noir",
        "screen": "15.6\\" HD",
        "os": "FreeDos",
        "processor_details": {
          "cache": "6 Mo",
          "cores": "Quad-Core",
          "frequency": "Up to 3,40 GHz Turbo max"
        },
        "keyboard": "noir profond, de grande taille avec pavé numérique",
        "connections": [
          "1x USB Type-C",
          "2x USB Type-A",
          "1x HDMI 1.4b",
          "1x prise combinée casque/microphone",
          "1x prise adaptateur secteur Smart Pin"
        ],
        "warranty": "1 an"
      }
    }

    Product type should be one of: "laptop", "desktop", "cpu", "gpu", "ram", "motherboard", "storage", "other"`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const rawData = JSON.parse(jsonMatch[0]);
      // Normalize the data to ensure all fields exist
      return normalizeProductData(rawData);
    }

    throw new Error('Could not extract JSON from AI response');
  } catch (error) {
    console.error('Gemini URL extraction error:', error);
    throw new Error('Failed to extract product info from URL');
  }
}

export async function extractProductFromHTML(html, url) {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Analyze this HTML content from ${url} and extract detailed product information.

    HTML Content (truncated):
    ${html}

    Please identify:
    1. Product type (laptop, desktop PC, CPU, GPU, RAM, motherboard, etc.)
    2. Complete product name
    3. Brand
    4. Model number
    5. Price sometimes is wrapped in div that has class containing "price"
    6. All technical specifications you can find:
       - CPU/Processor (exact model)
       - GPU/Graphics Card (exact model)
       - RAM (e.g., "16 GB DDR5", "32 GB")
       - Storage (e.g., "512 GB SSD", "1 TB NVMe SSD")
       - Color (e.g., "Silver", "Black", "Space Gray")
       - Any other relevant specs

    Return in JSON format with fields: productType, fullName, brand, model, price, specifications (object with cpu, gpu, ram, storage, color, etc.).
    Product type should be one of: "laptop", "desktop", "cpu", "gpu", "ram", "motherboard", "storage", "other"

    Example response:
    {
      "productType": "laptop",
      "fullName": "HP OmniBook X 14",
      "brand": "HP",
      "model": "fm0019nk",
      "price": "$1,299",
      "specifications": {
        "cpu": "Snapdragon X X1 26 100",
        "gpu": "Qualcomm Adreno",
        "ram": "16 GB",
        "storage": "512 GB SSD",
        "color": "Silver"
      }
    }`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    throw new Error('Could not extract JSON from AI response');
  } catch (error) {
    console.error('Gemini extraction error:', error);
    throw new Error('Failed to extract product info from HTML');
  }
}

export async function simplifyProductName(productName) {
  try {
    console.log(`🔄 Simplifying product name: ${productName}`);

    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Simplify this product name to only essential search terms: "${productName}"

Extract ONLY:
1. Brand (e.g., HP, Dell, Lenovo, ASUS)
2. Product Line/Series (e.g., OmniBook X 14, ThinkPad X1, ROG Zephyrus)
3. CPU/Processor model (e.g., Ultra 7 256V, Core i7-13700H, Ryzen 9 7940HS)

Remove:
- Storage specifications (16 Go, 512 Go SSD, 1TB, etc.)
- RAM specifications (DDR5, 16GB, etc.)
- Operating system (Windows 11, etc.)
- Colors (Argent, Silver, Black, etc.)
- SKU/Model numbers (fm0019nk, etc.)
- Generic terms (PC Portable, Laptop, Ordinateur, etc.)

Return ONLY the simplified name, nothing else. No explanations.

Examples:
Input: "PC Portable HP Omnibook X 14-fm0019nk Ultra 7 256V 16 Go DDR5 512 Go SSD Windows 11 Argent"
Output: HP Omnibook X 14 Ultra 7 256V

Input: "Dell XPS 15 9530 Intel Core i7-13700H 32GB RAM 1TB SSD Windows 11 Pro Silver"
Output: Dell XPS 15 Intel Core i7-13700H

Input: "Lenovo ThinkPad X1 Carbon Gen 11 i5-1335U 16GB 512GB SSD"
Output: Lenovo ThinkPad X1 Carbon i5-1335U`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const simplifiedName = response.text().trim();

    console.log(`✅ Simplified name: ${simplifiedName}`);

    return simplifiedName;
  } catch (error) {
    console.error('Product name simplification error:', error.message);
    // Return original name if simplification fails
    return productName;
  }
}

export async function findNotebookcheckReview(productName) {
  try {
    console.log(`🔍 Searching Notebookcheck using Google Custom Search API for: ${productName}`);

    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_CX;

    if (!apiKey || !cx) {
      throw new Error('GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_CX not set in environment variables');
    }

    // Build search query - restrict to notebookcheck.net
    const searchQuery = `${productName}`;
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(searchQuery)}`;

    console.log(`📄 Google Custom Search API query: ${searchQuery}`);

    const axios = (await import('axios')).default;
    const { data } = await axios.get(searchUrl);

    // Check if we got results
    if (!data.items || data.items.length === 0) {
      console.log('❌ No Notebookcheck review found in search results');
      return { found: false, reviewUrl: null };
    }

    // Get the first result
    const firstResult = data.items[0];
    const reviewUrl = firstResult.link;

    console.log(`✅ Found Notebookcheck result: ${firstResult.title}`);
    console.log(`📄 Review URL: ${reviewUrl}`);

    return { found: true, reviewUrl: reviewUrl };

  } catch (error) {
    console.error('Google Custom Search API error:', error.message);

    // Provide helpful error message for common issues
    if (error.response?.status === 400) {
      console.error('❌ Invalid API key or Search Engine ID. Please check your .env file.');
    } else if (error.response?.status === 403) {
      console.error('❌ API quota exceeded or invalid credentials.');
    }

    return { found: false, reviewUrl: null, error: error.message };
  }
}

export async function analyzeCPUPerformance(cpuName) {
  try {
    console.log(`🔍 Using Gemini with Google Search to analyze CPU performance: ${cpuName}`);
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',
      tools: [{
        googleSearch: {}
      }]
    });

    const prompt = `Analyze the performance of this CPU: ${cpuName}

    Search for comprehensive benchmark data and provide detailed analysis including:

    CPU Performance:
    1. Performance category (entry-level, mid-range, high-end, flagship)
    2. Single-core performance description with scores (Cinebench, Geekbench, etc.)
    3. Multi-core performance description with scores
    4. Power efficiency and TDP details
    5. Best use cases (office work, gaming, content creation, etc.)
    6. Synthetic benchmark scores from Notebookcheck if available (Cinebench R15/R23, PCMark, 3DMark CPU tests)

    Integrated GPU Analysis (if CPU has integrated graphics):
    7. Integrated GPU name and model
    8. GPU gaming performance - search for FPS in popular games (Fortnite, CS:GO, GTA V, Valorant, etc.)
    9. Synthetic GPU benchmarks (3DMark Time Spy/Fire Strike, Unigine, etc.)
    10. GPU capabilities (video decoding, display outputs, max resolution)

    Return in JSON format with fields:
    - category, singleCore, multiCore, powerEfficiency, useCases, benchmarkScores (object with benchmark names and scores)
    - integratedGPU: object with { name, gamingPerformance (array of {game, fps, settings}), syntheticBenchmarks (object), capabilities }`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { note: 'Could not analyze CPU performance' };
  } catch (error) {
    console.error('Gemini CPU analysis error:', error);
    return { error: 'Failed to analyze CPU', note: error.message };
  }
}

export async function extractNotebookcheckData(html) {
  try {
    const $ = cheerio.load(html);

    let batteryLife = null;
    let displayQuality = null;
    let weight = null;

    // Extract battery life from .barcharts
    $('.barcharts .barline').each((_index, elem) => {
      const title = $(elem).find('.bartitle').text().trim();
      const value = $(elem).find('.barvalue').text().trim();

      // Look for WiFi Websurfing or similar battery test
      if (title && title.toLowerCase().includes('wifi') && value) {
        batteryLife = value;
      }
    });

    // Extract specifications from .specs_whole table
    $('.specs_whole table tr').each((_index, row) => {
      const $row = $(row);
      const header = $row.find('th').text().trim().toLowerCase();
      const value = $row.find('td');

      // Display
      if (header.includes('display')) {
        displayQuality = value.text().trim() || null;
      }

      // Weight
      if (header.includes('weight')) {
        weight = value.text().trim() || null;
      }
    });

    console.log(`📊 Extracted laptop data: Battery=${batteryLife}, Display=${displayQuality}, Weight=${weight}`);

    return {
      batteryLife,
      displayQuality,
      weight
    };
  } catch (error) {
    console.error('Notebookcheck laptop data extraction error:', error);
    return {
      batteryLife: null,
      displayQuality: null,
      weight: null,
      error: 'Failed to extract laptop data',
      note: error.message
    };
  }
}

export async function extractGPUBenchmarkData(html, gpuName) {
  try {
    const $ = cheerio.load(html);

    // Extract GPU specifications from .contenttable
    const specsTable = $('.contenttable').first();
    const gpuSpecs = {};

    specsTable.find('tr').each((_index, row) => {
      const caption = $(row).find('.caption').text().trim();
      const value = $(row).find('td:not(.caption)').first().text().trim();

      if (caption && value) {
        gpuSpecs[caption] = value;
      }
    });

    console.log(`📋 Extracted ${Object.keys(gpuSpecs).length} GPU specifications`);

    // Extract gaming FPS data from .contenttable.fpstable
    const games = [];
    const fpsTable = $('.contenttable.fpstable');

    fpsTable.find('tr').each((_index, row) => {
      const $row = $(row);
      const gameLink = $row.find('th a').first();

      if (gameLink.length > 0) {
        const gameName = gameLink.text().trim();
        const cells = $row.find('td');

        if (cells.length >= 6) {
          const game = {
            game: gameName,
            low: cells.eq(0).text().trim() || null,
            medium: cells.eq(1).text().trim() || null,
            high: cells.eq(2).text().trim() || null,
            ultra: cells.eq(3).text().trim() || null,
            qhd: cells.eq(4).text().trim() || null,
            '4k': cells.eq(5).text().trim() || null
          };

          // Convert empty strings to null
          Object.keys(game).forEach(key => {
            if (game[key] === '') {
              game[key] = null;
            }
          });

          games.push(game);
        }
      }
    });

    console.log(`🎮 Extracted ${games.length} GPU gaming benchmarks`);

    return {
      gpuName: gpuName,
      gpuSpecs: gpuSpecs,
      games: games
    };
  } catch (error) {
    console.error('GPU benchmark extraction error:', error);
    return {
      gpuName: gpuName,
      gpuSpecs: {},
      games: [],
      error: 'Failed to extract GPU benchmark data',
      note: error.message
    };
  }
}

export async function extractCPUBenchmarkData(html, cpuName) {
  try {
    const $ = cheerio.load(html);

    // Helper function to parse benchmark score string into structured object
    const parseScore = (scoreText) => {
      const parsed = {
        min: null,
        avg: null,
        median: null,
        max: null,
        unit: null,
        raw: scoreText
      };

      // Extract min value
      const minMatch = scoreText.match(/min:\s*([\d.]+)/);
      if (minMatch) {
        parsed.min = parseFloat(minMatch[1]);
      }

      // Extract avg value
      const avgMatch = scoreText.match(/avg:\s*([\d.]+)/);
      if (avgMatch) {
        parsed.avg = parseFloat(avgMatch[1]);
      }

      // Extract median value
      const medianMatch = scoreText.match(/median:\s*([\d.]+)/);
      if (medianMatch) {
        parsed.median = parseFloat(medianMatch[1]);
      }

      // Extract max value
      const maxMatch = scoreText.match(/max:\s*([\d.]+)/);
      if (maxMatch) {
        parsed.max = parseFloat(maxMatch[1]);
      }

      // If no structured data found, try to extract first number and unit
      if (!parsed.min && !parsed.avg && !parsed.median && !parsed.max) {
        // Match patterns like "4927 Points" or "970 s"
        const simpleMatch = scoreText.match(/^[\s\n]*([\d.]+)\s+(Points|s|fps|MIPS|Watt|MB\/s|GB\/s|ms|Seconds)\b/i);
        if (simpleMatch) {
          const value = parseFloat(simpleMatch[1]);
          parsed.avg = value;
          parsed.median = value;
          parsed.unit = simpleMatch[2];
        }
      }

      // Extract unit if not already set
      if (!parsed.unit) {
        const unitMatch = scoreText.match(/([A-Za-z/%]+)\s*$/);
        if (unitMatch) {
          parsed.unit = unitMatch[1];
        }
      }

      return parsed;
    };

    // Extract CPU benchmark scores using .gpusingle_benchmarks .gpubench_div
    const benchmarks = [];
    $('.gpusingle_benchmarks .gpubench_div').each((_index, item) => {
      const name = $(item).find('.gpubench_benchmark').text().trim();
      const scoreText = $(item).find('div:nth-child(2)').text().trim();
      if (name && scoreText) {
        benchmarks.push({
          name,
          score: parseScore(scoreText)
        });
      }
    });

    console.log(`📊 Extracted ${benchmarks.length} CPU benchmarks`);

    // Extract CPU specifications from .contenttable
    const specsTable = $('.contenttable').first();
    const specs = {};

    specsTable.find('tr').each((_index, row) => {
      const caption = $(row).find('.caption').text().trim();
      const value = $(row).find('td:not(.caption)').first().text().trim();

      if (caption && value) {
        specs[caption] = value;
      }
    });

    console.log(`📋 Extracted ${Object.keys(specs).length} CPU specifications`);

    return {
      cpuName: cpuName,
      specifications: specs,
      benchmarks: benchmarks
    };
  } catch (error) {
    console.error('CPU benchmark extraction error:', error);
    return {
      cpuName: cpuName,
      specifications: {},
      benchmarks: [],
      error: 'Failed to extract CPU benchmark data',
      note: error.message
    };
  }
}

export async function extractChaynikamData(html, gpuName) {
  try {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Analyze this Chaynikam.info GPU page HTML and extract game performance data.

    GPU: ${gpuName}

    HTML Content (truncated):
    ${html.substring(0, 15000)}

    Please extract all gaming FPS benchmarks from this page. Look for:
    1. Game names
    2. FPS (frames per second) values
    3. Resolution and graphics settings (e.g., 1080p Low, 1440p High, etc.)
    4. Any additional notes about the performance

    Return in JSON format with field:
    - games: array of {game, fps, settings} objects

    Example format:
    {
      "games": [
        {"game": "Cyberpunk 2077", "fps": "45", "settings": "1080p High"},
        {"game": "Fortnite", "fps": "120", "settings": "1080p Medium"}
      ]
    }

    If no game data found, return {"games": []}.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return { games: [] };
  } catch (error) {
    console.error('Gemini Chaynikam extraction error:', error);
    return {
      games: [],
      error: 'Failed to extract game data with AI',
      note: error.message
    };
  }
}
