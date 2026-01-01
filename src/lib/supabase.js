import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get cached product info from URL
 * @param {string} url - The product URL
 * @returns {Promise<Object|null>} Cached product info or null
 */
export async function getCachedProduct(url) {
  try {
    const { data, error } = await supabase
      .from('product_cache')
      .select('*')
      .eq('url', url)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    if (data) {
      // Reconstruct productInfo object from cache
      return {
        productType: data.product_type,
        fullName: data.full_name,
        brand: data.brand,
        model: data.model,
        price: data.price,
        specifications: data.specifications
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching cached product:', error);
    return null;
  }
}

/**
 * Store product info in cache
 * @param {string} url - The product URL
 * @param {Object} productInfo - The product information to cache
 * @returns {Promise<boolean>} Success status
 */
export async function cacheProduct(url, productInfo) {
  try {
    const { error } = await supabase
      .from('product_cache')
      .upsert({
        url: url,
        product_type: productInfo.productType,
        full_name: productInfo.fullName,
        brand: productInfo.brand,
        model: productInfo.model,
        price: productInfo.price,
        specifications: productInfo.specifications
      }, {
        onConflict: 'url'
      });

    if (error) {
      console.error('Error caching product:', error);
      return false;
    }

    console.log(`✅ Product cached successfully: ${url}`);
    return true;
  } catch (error) {
    console.error('Error caching product:', error);
    return false;
  }
}

/**
 * Get cached GPU benchmark data
 * @param {string} gpuName - The GPU name
 * @returns {Promise<Object|null>} Cached GPU benchmark data or null
 */
export async function getCachedGPUBenchmark(gpuName) {
  try {
    const { data, error } = await supabase
      .from('gpu_benchmark_cache')
      .select('*')
      .eq('gpu_name', gpuName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    if (data) {
      // Reconstruct GPU benchmark result from cache
      return {
        found: data.found,
        gpuReviewUrl: data.review_url,
        gpuBenchmarkData: data.found ? {
          gpuName: gpuName,
          gpuSpecs: data.gpu_specs || {},
          games: data.games || []
        } : null,
        error: data.error_message
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching cached GPU benchmark:', error);
    return null;
  }
}

/**
 * Store GPU benchmark data in cache
 * @param {string} gpuName - The GPU name
 * @param {Object} gpuResult - The GPU benchmark result to cache
 * @returns {Promise<boolean>} Success status
 */
export async function cacheGPUBenchmark(gpuName, gpuResult) {
  try {
    const { error } = await supabase
      .from('gpu_benchmark_cache')
      .upsert({
        gpu_name: gpuName,
        review_url: gpuResult.gpuReviewUrl,
        found: gpuResult.found,
        gpu_specs: gpuResult.gpuBenchmarkData?.gpuSpecs || null,
        games: gpuResult.gpuBenchmarkData?.games || null,
        error_message: gpuResult.error || null
      }, {
        onConflict: 'gpu_name'
      });

    if (error) {
      console.error('Error caching GPU benchmark:', error);
      return false;
    }

    console.log(`✅ GPU benchmark cached successfully: ${gpuName}`);
    return true;
  } catch (error) {
    console.error('Error caching GPU benchmark:', error);
    return false;
  }
}

/**
 * Get cached CPU benchmark data
 * @param {string} cpuName - The CPU name
 * @returns {Promise<Object|null>} Cached CPU benchmark data or null
 */
export async function getCachedCPUBenchmark(cpuName) {
  try {
    const { data, error } = await supabase
      .from('cpu_benchmark_cache')
      .select('*')
      .eq('cpu_name', cpuName)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw error;
    }

    if (data) {
      // Reconstruct CPU benchmark result from cache
      return {
        found: data.found,
        cpuReviewUrl: data.review_url,
        cpuBenchmarkData: data.found ? {
          benchmarks: data.benchmarks || null,
          specifications: data.specifications || null
        } : null,
        error: data.error_message
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching cached CPU benchmark:', error);
    return null;
  }
}

/**
 * Store CPU benchmark data in cache
 * @param {string} cpuName - The CPU name
 * @param {Object} cpuResult - The CPU benchmark result to cache
 * @returns {Promise<boolean>} Success status
 */
export async function cacheCPUBenchmark(cpuName, cpuResult) {
  try {
    const { error } = await supabase
      .from('cpu_benchmark_cache')
      .upsert({
        cpu_name: cpuName,
        review_url: cpuResult.cpuReviewUrl,
        found: cpuResult.found,
        benchmarks: cpuResult.cpuBenchmarkData?.benchmarks || null,
        specifications: cpuResult.cpuBenchmarkData?.specifications || null,
        error_message: cpuResult.error || null
      }, {
        onConflict: 'cpu_name'
      });

    if (error) {
      console.error('Error caching CPU benchmark:', error);
      return false;
    }

    console.log(`✅ CPU benchmark cached successfully: ${cpuName}`);
    return true;
  } catch (error) {
    console.error('Error caching CPU benchmark:', error);
    return false;
  }
}
