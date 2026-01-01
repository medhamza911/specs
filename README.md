# PC Benchmark Analyzer

An AI-powered web application that analyzes PC component specifications and benchmarks from product URLs. This tool helps users compare laptops, desktops, and PC components by automatically extracting product details and fetching comprehensive benchmark data.

## Features

- **AI-Powered Product Extraction**: Uses Google Gemini AI to extract detailed product specifications from any product URL
- **Automated Benchmark Retrieval**: Fetches CPU and GPU benchmarks from Notebookcheck.net
- **Intelligent Caching**: Stores product data and benchmarks in Supabase to minimize API calls and improve performance
- **Side-by-Side Comparison**: Interactive comparison table for multiple laptops with gaming performance metrics
- **Gaming Performance Data**: Displays FPS benchmarks across multiple games at different quality settings
- **Export Functionality**: Export comparison data to CSV format

## Tech Stack

### Backend
- **Framework**: [Hono](https://hono.dev/) - Fast, lightweight web framework for Edge computing
- **Runtime**: Node.js with Cloudflare Workers compatibility (via Wrangler)
- **AI/ML**: Google Gemini AI (gemini-2.5-flash-lite) for intelligent data extraction
- **Database**: Supabase (PostgreSQL) for caching
- **Web Scraping**: Cheerio for HTML parsing, Axios for HTTP requests

### Frontend
- Vanilla JavaScript
- Responsive CSS with gradient UI design
- Interactive comparison tables with sticky columns

## Prerequisites

Before you begin, ensure you have the following:

- Node.js (v16 or higher)
- npm or yarn package manager
- Google Gemini API key ([Get it here](https://makersuite.google.com/app/apikey))
- Google Custom Search API credentials:
  - API Key ([Get it here](https://developers.google.com/custom-search/v1/overview))
  - Custom Search Engine ID ([Create one here](https://programmablesearchengine.google.com/))
- Supabase account and project ([Sign up](https://supabase.com))

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd specs
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env` file in the root directory by copying the example:
```bash
cp .env.example .env
```

Edit `.env` with your actual credentials:
```env
# Google Gemini API Key
GEMINI_API_KEY=your_google_gemini_api_key_here

# Google Custom Search API
GOOGLE_SEARCH_API_KEY=your_google_search_api_key_here
GOOGLE_SEARCH_CX=your_google_search_cx_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here

# Server Configuration
PORT=3000
NODE_ENV=development
```

4. Set up Supabase database:

Create the following tables in your Supabase project:

**product_cache table**:
```sql
CREATE TABLE product_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  product_type TEXT,
  full_name TEXT,
  brand TEXT,
  model TEXT,
  price TEXT,
  specifications JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**gpu_benchmark_cache table**:
```sql
CREATE TABLE gpu_benchmark_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gpu_name TEXT UNIQUE NOT NULL,
  review_url TEXT,
  found BOOLEAN DEFAULT FALSE,
  gpu_specs JSONB,
  games JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**cpu_benchmark_cache table**:
```sql
CREATE TABLE cpu_benchmark_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cpu_name TEXT UNIQUE NOT NULL,
  review_url TEXT,
  found BOOLEAN DEFAULT FALSE,
  benchmarks JSONB,
  specifications JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Usage

### Development Mode

Start the development server with hot reload:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Mode

Start the production server:

```bash
npm start
```

### Deploy to Cloudflare Workers

Deploy to Cloudflare Workers using Wrangler:

```bash
npm run deploy
```

## API Endpoints

### POST /api/analyze/laptop

Analyzes a laptop product URL and returns comprehensive information including product details and benchmark data.

**Request Body**:
```json
{
  "url": "https://example.com/product/laptop-xyz"
}
```

**Response**:
```json
{
  "success": true,
  "product": {
    "productType": "laptop",
    "fullName": "HP OmniBook X 14",
    "brand": "HP",
    "model": "fm0019nk",
    "price": "$1,299",
    "specifications": {
      "cpu": "Intel Core i7-13700H",
      "gpu": "NVIDIA GeForce RTX 4060",
      "ram": "16 GB DDR5",
      "storage": "512 GB SSD",
      "screen": "14\" FHD",
      "os": "Windows 11",
      "color": "Silver"
    }
  },
  "benchmarks": {
    "cpu": {
      "found": true,
      "name": "Intel Core i7-13700H",
      "reviewUrl": "https://www.notebookcheck.net/...",
      "benchmarks": [...],
      "specifications": {...}
    },
    "gpu": {
      "found": true,
      "name": "NVIDIA GeForce RTX 4060",
      "reviewUrl": "https://www.notebookcheck.net/...",
      "gpuSpecs": {...},
      "games": [
        {
          "game": "Cyberpunk 2077",
          "low": "120 fps",
          "medium": "95 fps",
          "high": "75 fps",
          "ultra": "60 fps"
        }
      ]
    }
  }
}
```

## Project Structure

```
specs/
├── src/
│   ├── index.js              # Main application entry point
│   ├── lib/
│   │   ├── gemini.js         # Google Gemini AI integration
│   │   └── supabase.js       # Supabase database client and caching
│   └── routes/
│       └── analyze.js        # API route handlers for laptop analysis
├── public/
│   ├── compare.html          # Laptop comparison UI
│   ├── css/
│   │   └── style.css         # Styles (embedded in HTML)
│   └── js/
│       └── compare.js        # Frontend comparison logic
├── package.json              # Project dependencies
├── wrangler.toml            # Cloudflare Workers configuration
├── .env.example             # Environment variables template
└── README.md                # This file
```

## Key Features Explained

### 1. Product Information Extraction (src/lib/gemini.js:284)

The application uses Google Gemini AI to extract product details from web pages by:
- Fetching the product page HTML
- Extracting unique CSS class selectors and their text content
- Using AI to identify and structure product specifications
- Normalizing data to ensure consistent schema

### 2. Benchmark Data Retrieval (src/routes/analyze.js:35)

The system automatically:
- Searches for Notebookcheck reviews using Google Custom Search API
- Extracts CPU benchmarks (Cinebench, Geekbench, etc.)
- Extracts GPU gaming performance (FPS across multiple games)
- Handles both dedicated and integrated GPUs

### 3. Intelligent Caching (src/lib/supabase.js)

To optimize performance and reduce API costs:
- Product information is cached by URL
- CPU benchmarks are cached by processor name
- GPU benchmarks are cached by graphics card name
- Cache hits avoid redundant AI calls and web scraping

### 4. GPU Detection (src/routes/analyze.js:18)

Smart detection of integrated vs dedicated GPUs:
- Identifies Intel UHD/Iris, AMD Radeon integrated graphics
- For integrated GPUs, extracts GPU info from CPU specifications
- Fetches appropriate benchmarks based on GPU type

## Configuration

### Cloudflare Workers (wrangler.toml:1)

The application is configured for deployment to Cloudflare Workers with Node.js compatibility enabled:

```toml
name = "pc-benchmark-analyzer"
main = "src/index.js"
compatibility_date = "2024-01-01"
node_compat = true
```

### Environment Variables

- `GEMINI_API_KEY`: Google Gemini API key for AI-powered extraction
- `GOOGLE_SEARCH_API_KEY`: Google Custom Search API key
- `GOOGLE_SEARCH_CX`: Custom Search Engine ID
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase anonymous/public key
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)

## Troubleshooting

### API Rate Limits

If you encounter rate limit errors:
- Google Custom Search API has a limit of 100 queries/day (free tier)
- Consider upgrading to a paid plan for higher quotas
- The caching system helps minimize API calls

### Gemini API Errors

If Gemini API fails:
- Verify your API key is valid
- Check your billing status on Google AI Studio
- Ensure you're not exceeding quota limits

### Database Connection Issues

If Supabase connection fails:
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are correct
- Ensure your Supabase project is active
- Check that tables are created with correct schemas

### CORS Issues

The application includes CORS middleware to allow cross-origin requests. If you encounter CORS errors, ensure the middleware is properly configured in `src/index.js:19`.

## Performance Optimization

- **Caching**: All API responses are cached in Supabase
- **Parallel Processing**: CPU and GPU benchmarks are fetched concurrently
- **Edge Computing**: Deployable to Cloudflare Workers for global edge performance
- **Lightweight Framework**: Hono provides minimal overhead

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgments

- [Google Gemini AI](https://ai.google.dev/) for intelligent data extraction
- [Notebookcheck](https://www.notebookcheck.net/) for comprehensive benchmark data
- [Hono](https://hono.dev/) for the lightweight web framework
- [Supabase](https://supabase.com/) for database and caching infrastructure

## Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

Built with AI-powered intelligence to make PC component comparison effortless.
