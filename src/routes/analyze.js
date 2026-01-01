import { Hono } from 'hono';
import axios from 'axios';
import { extractProductFromURL } from '../lib/gemini.js';
import {
  getCachedProduct,
  cacheProduct,
  getCachedGPUBenchmark,
  cacheGPUBenchmark,
  getCachedCPUBenchmark,
  cacheCPUBenchmark
} from '../lib/supabase.js';

const analyzeRoute = new Hono();

/**
 * Helper function to detect if GPU is integrated
 */
function isIntegratedGPU(name) {
  if (!name) return false;
  const lowerName = name.toLowerCase();
  return lowerName.includes('intel') ||
    lowerName.includes('uhd') ||
    lowerName.includes('iris') ||
    lowerName.includes('radeon graphics') ||
    lowerName.includes('vega') ||
    lowerName.includes('amd graphics') ||
    lowerName.includes('amd');
}

/**
 * Process CPU benchmarks: fetch review and extract benchmark data
 * @param {string} cpuName - The CPU name to analyze
 * @returns {Promise<Object>} CPU benchmark data with reviewUrl
 */
async function processCPUBenchmark(cpuName) {
  const { findNotebookcheckReview, extractCPUBenchmarkData } = await import('../lib/gemini.js');

  console.log(`📊 Fetching CPU benchmarks for: ${cpuName}`);

  // Check cache first
  console.log(`💾 Checking CPU benchmark cache for: ${cpuName}`);
  const cachedCPU = await getCachedCPUBenchmark(cpuName);

  if (cachedCPU) {
    console.log(`✅ CPU benchmark cache hit! Using cached data`);
    return cachedCPU;
  }

  console.log(`❌ CPU benchmark cache miss. Fetching from web...`);

  try {
    const cpuSearchResult = await findNotebookcheckReview(cpuName);

    if (!cpuSearchResult.found || !cpuSearchResult.reviewUrl) {
      console.log(`❌ CPU review not found for: ${cpuName}`);
      const result = {
        found: false,
        cpuReviewUrl: null,
        cpuBenchmarkData: null,
        error: 'CPU review not found'
      };
      // Cache the negative result
      await cacheCPUBenchmark(cpuName, result);
      return result;
    }

    console.log(`✅ Found CPU review: ${cpuSearchResult.reviewUrl}`);

    const cpuResponse = await axios.get(cpuSearchResult.reviewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: (status) => status < 500
    });

    const cpuBenchmarkData = await extractCPUBenchmarkData(cpuResponse.data, cpuName);
    console.log(`✅ CPU benchmarks extracted`);

    const result = {
      found: true,
      cpuReviewUrl: cpuSearchResult.reviewUrl,
      cpuBenchmarkData
    };

    // Cache the successful result
    await cacheCPUBenchmark(cpuName, result);

    return result;
  } catch (error) {
    console.error(`⚠️  Error fetching CPU data: ${error.message}`);
    const result = {
      found: false,
      cpuReviewUrl: null,
      cpuBenchmarkData: null,
      error: error.message
    };
    // Cache the error result
    await cacheCPUBenchmark(cpuName, result);
    return result;
  }
}

/**
 * Process GPU benchmarks: fetch review and extract benchmark data
 * @param {string} gpuName - The GPU name to analyze
 * @returns {Promise<Object>} GPU benchmark data with reviewUrl
 */
async function processGPUBenchmark(gpuName) {
  const { findNotebookcheckReview, extractGPUBenchmarkData } = await import('../lib/gemini.js');

  console.log(`🔍 Searching for GPU review: ${gpuName}`);

  // Check cache first
  console.log(`💾 Checking GPU benchmark cache for: ${gpuName}`);
  const cachedGPU = await getCachedGPUBenchmark(gpuName);

  if (cachedGPU) {
    console.log(`✅ GPU benchmark cache hit! Using cached data`);
    return cachedGPU;
  }

  console.log(`❌ GPU benchmark cache miss. Fetching from web...`);

  try {
    const gpuSearchResult = await findNotebookcheckReview(gpuName + " Benchmarks and Specs");

    if (!gpuSearchResult.found || !gpuSearchResult.reviewUrl) {
      console.log('❌ No GPU review found');
      const result = {
        found: false,
        gpuReviewUrl: null,
        gpuBenchmarkData: null,
        error: 'No GPU review found'
      };
      // Cache the negative result to avoid repeated searches
      await cacheGPUBenchmark(gpuName, result);
      return result;
    }

    console.log(`✅ Found GPU review: ${gpuSearchResult.reviewUrl}`);
    console.log(`📄 Fetching GPU review page: ${gpuSearchResult.reviewUrl}`);

    const { data: gpuReviewHtml } = await axios.get(gpuSearchResult.reviewUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      validateStatus: (status) => status < 500
    });

    // Check if we got a 404 status code
    if (gpuReviewHtml.status === 404) {
      throw new Error('404 - Page not found');
    }

    console.log(`🤖 Parsing GPU benchmarks with AI`);
    const gpuBenchmarkData = await extractGPUBenchmarkData(gpuReviewHtml, gpuName);

    const result = {
      found: true,
      gpuReviewUrl: gpuSearchResult.reviewUrl,
      gpuBenchmarkData
    };

    // Cache the successful result
    await cacheGPUBenchmark(gpuName, result);

    return result;
  } catch (error) {
    console.error(`❌ Failed to fetch GPU review: ${error.message}`);
    const result = {
      found: false,
      gpuReviewUrl: null,
      gpuBenchmarkData: null,
      error: error.message
    };
    // Cache the error result
    await cacheGPUBenchmark(gpuName, result);
    return result;
  }
}



/**
 * Initialize empty benchmark response structure
 */
function createEmptyBenchmarkResponse() {
  return {
    gpu: {
      found: false,
      reviewUrl: null,
      name: null,
      originalName: null,
      type: null,
      gpuName: null,
      gpuSpecs: {},
      games: [],
      note: null
    },
    cpu: {
      found: false,
      name: null,
      reviewUrl: null,
      benchmarks: null,
      specifications: null,
      note: null
    }
  };
}

/**
 * Process dedicated GPU benchmarks
 */
async function processDedicatedGPU(gpuName, cpuName) {
  const { extractCleanGpuName } = await import('../lib/gemini.js');

  console.log(`🎮 Processing dedicated GPU: ${gpuName}`);

  const cleanGpuName = extractCleanGpuName(gpuName);
  console.log(`📝 Cleaned GPU name: "${cleanGpuName}" (from: "${gpuName}")`);
  const finalGpuName = cleanGpuName || gpuName;

  // Fetch CPU and GPU benchmarks in parallel
  const [cpuResult, gpuResult] = await Promise.all([
    processCPUBenchmark(cpuName),
    processGPUBenchmark(finalGpuName)
  ]);

  return {
    finalGpuName,
    isIntegrated: false,
    cpuResult,
    gpuResult
  };
}

/**
 * Process integrated GPU benchmarks
 */
async function processIntegratedGPU(cpuName) {
  console.log(`💻 GPU is integrated or not provided, fetching from CPU specs: ${cpuName}`);

  // Fetch CPU benchmarks first
  const cpuResult = await processCPUBenchmark(cpuName);

  let finalGpuName = null;
  let gpuResult = null;

  if (cpuResult.found && cpuResult.cpuBenchmarkData.specifications?.GPU) {
    finalGpuName = cpuResult.cpuBenchmarkData.specifications.GPU;
    console.log(`✅ Extracted integrated GPU from CPU specs: ${finalGpuName}`);

    // Fetch GPU benchmarks
    gpuResult = await processGPUBenchmark(finalGpuName);
  } else {
    console.log(`⚠️  No integrated GPU found in CPU specs`);
  }

  return {
    finalGpuName,
    isIntegrated: true,
    cpuResult,
    gpuResult
  };
}

/**
 * Populate CPU benchmark data in response
 */
function populateCPUBenchmarks(responseData, cpuName, cpuResult) {
  if (cpuResult && cpuResult.found) {
    console.log(`✅ CPU benchmarks found`);
    responseData.benchmarks.cpu.found = true;
    responseData.benchmarks.cpu.name = cpuName;
    responseData.benchmarks.cpu.reviewUrl = cpuResult.cpuReviewUrl;
    responseData.benchmarks.cpu.benchmarks = cpuResult.cpuBenchmarkData?.benchmarks || null;
    responseData.benchmarks.cpu.specifications = cpuResult.cpuBenchmarkData?.specifications || null;
  } else {
    console.log(`⚠️  CPU benchmarks not found`);
    responseData.benchmarks.cpu.name = cpuName;
    responseData.benchmarks.cpu.note = cpuResult?.error || 'CPU review not found';
  }
}

/**
 * Populate GPU benchmark data in response
 */
function populateGPUBenchmarks(responseData, gpuName, finalGpuName, isIntegrated, gpuResult) {
  if (gpuResult && gpuResult.found) {
    console.log(`✅ GPU benchmarks found`);
    responseData.benchmarks.gpu.found = true;
    responseData.benchmarks.gpu.reviewUrl = gpuResult.gpuReviewUrl;
    responseData.benchmarks.gpu.name = finalGpuName;
    responseData.benchmarks.gpu.originalName = finalGpuName;
    responseData.benchmarks.gpu.type = isIntegrated ? 'integrated' : 'dedicated';
    responseData.benchmarks.gpu.gpuName = gpuResult.gpuBenchmarkData?.gpuName || finalGpuName;
    responseData.benchmarks.gpu.gpuSpecs = gpuResult.gpuBenchmarkData?.gpuSpecs || {};
    responseData.benchmarks.gpu.games = gpuResult.gpuBenchmarkData?.games || [];
  } else if (finalGpuName) {
    console.log(`⚠️  GPU benchmarks not found`);
    responseData.benchmarks.gpu.name = finalGpuName;
    responseData.benchmarks.gpu.type = isIntegrated ? 'integrated' : 'dedicated';
    responseData.benchmarks.gpu.note = gpuResult?.error || 'GPU review not found';
  } else if (gpuName) {
    responseData.benchmarks.gpu.name = gpuName;
    responseData.benchmarks.gpu.note = 'GPU information available but benchmarks not found';
  }
}

/**
 * POST /api/analyze/laptop
 * Complete laptop analysis: Takes product URL and returns both product info and GPU benchmarks
 */
analyzeRoute.post('/analyze/laptop', async (c) => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return c.json({ error: 'Invalid URL format' }, 400);
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🚀 Starting complete laptop analysis for: ${url}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Step 1: Check cache first
    console.log(`💾 Checking cache for: ${url}`);
    let productInfo = await getCachedProduct(url);

    if (productInfo) {
      console.log(`✅ Cache hit! Using cached product info: ${productInfo.productType} - ${productInfo.fullName || `${productInfo.brand} ${productInfo.model}`}`);
    } else {
      console.log(`❌ Cache miss. Extracting product information...`);
      console.log(`🤖 Sending URL to Gemini AI for product extraction: ${url}`);
      productInfo = await extractProductFromURL(url);
      console.log(`✅ Product identified: ${productInfo.productType} - ${productInfo.fullName || `${productInfo.brand} ${productInfo.model}`}`);

      // Cache the extracted product info
      await cacheProduct(url, productInfo);
    }

    // Initialize response structure
    const responseData = {
      success: true,
      product: productInfo,
      benchmarks: createEmptyBenchmarkResponse()
    };

    // Step 2: Extract CPU and GPU names from product info
    const cpuName = productInfo.specifications?.cpu;
    const gpuName = productInfo.specifications?.gpu;

    if (!cpuName) {
      console.log(`⚠️  No CPU found in product specifications, skipping benchmark analysis`);
      responseData.benchmarks.cpu.note = 'CPU name not found in product specifications';
      responseData.benchmarks.gpu.note = 'Cannot analyze GPU without CPU information';
      console.log(`\n✅ Product analysis complete (no benchmarks)!\n`);
    } else {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🎮 Starting GPU benchmark analysis`);
      console.log(`   CPU: ${cpuName}`);
      if (gpuName) console.log(`   GPU: ${gpuName}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

      // Step 3: Process benchmarks based on GPU type
      let benchmarkResults;
      if (gpuName && !isIntegratedGPU(gpuName)) {
        benchmarkResults = await processDedicatedGPU(gpuName, cpuName);
      } else {
        benchmarkResults = await processIntegratedGPU(cpuName);
      }

      // Step 4: Populate response with benchmark data
      populateCPUBenchmarks(responseData, cpuName, benchmarkResults.cpuResult);
      populateGPUBenchmarks(
        responseData,
        gpuName,
        benchmarkResults.finalGpuName,
        benchmarkResults.isIntegrated,
        benchmarkResults.gpuResult
      );

      console.log(`\n✅ Complete laptop analysis finished!\n`);
    }

    // Single return statement at the end
    return c.json(responseData);
  } catch (error) {
    console.error('Complete laptop analysis error:', error);
    return c.json({
      success: false,
      error: 'Failed to analyze laptop',
      message: error.message
    }, 500);
  }
});





export { analyzeRoute };
