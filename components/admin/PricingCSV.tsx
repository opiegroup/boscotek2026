import React, { useState, useRef } from 'react';
import { useCatalog } from '../../contexts/CatalogContext';
import { supabase } from '../../services/supabaseClient';

interface PriceRow {
  type: string;
  product_id: string;
  product_name: string;
  group_id: string;
  group_name: string;
  option_id: string;
  option_name: string;
  code: string;
  price: number;
}

const PricingCSV: React.FC = () => {
  const { products, interiors, refreshCatalog } = useCatalog();
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate CSV data from products
  const generateCSV = (): string => {
    const rows: PriceRow[] = [];

    // Add product base prices
    (products || []).forEach(product => {
      rows.push({
        type: 'BASE_PRICE',
        product_id: product.id,
        product_name: product.name,
        group_id: '',
        group_name: '',
        option_id: '',
        option_name: '',
        code: product.id,
        price: product.basePrice,
      });

      // Add option prices
      product.groups.forEach(group => {
        group.options.forEach(option => {
          if (option.priceDelta !== undefined && option.priceDelta !== 0) {
            rows.push({
              type: 'OPTION',
              product_id: product.id,
              product_name: product.name,
              group_id: group.id,
              group_name: group.label,
              option_id: option.id,
              option_name: option.label,
              code: option.code || option.id,
              price: option.priceDelta,
            });
          }
        });
      });
    });

    // Add interior prices
    (interiors || []).forEach(interior => {
      rows.push({
        type: 'INTERIOR',
        product_id: '',
        product_name: '',
        group_id: '',
        group_name: 'Drawer Interiors',
        option_id: interior.id,
        option_name: interior.layout_description,
        code: interior.code || interior.id,
        price: interior.price,
      });
    });

    // Convert to CSV
    const headers = ['type', 'product_id', 'product_name', 'group_id', 'group_name', 'option_id', 'option_name', 'code', 'price'];
    const csvRows = [
      headers.join(','),
      ...rows.map(row => 
        headers.map(h => {
          const value = row[h as keyof PriceRow];
          // Quote strings that might contain commas
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  };

  // Download CSV
  const handleDownload = () => {
    const csv = generateCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boscotek_pricing_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse CSV
  const parseCSV = (text: string): PriceRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: PriceRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const row: any = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx];
      });

      // Parse price as number
      row.price = parseFloat(row.price) || 0;
      rows.push(row);
    }

    return rows;
  };

  // Parse a single CSV line (handling quoted values)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  // Import CSV
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      let success = 0;
      const errors: string[] = [];

      for (const row of rows) {
        try {
          if (row.type === 'BASE_PRICE' && row.product_id) {
            // Update product base price
            const product = products.find(p => p.id === row.product_id);
            if (product) {
              product.basePrice = row.price;
              
              await supabase.from('products').update({
                base_price: row.price,
                data: product
              }).eq('id', row.product_id);
              
              success++;
            } else {
              errors.push(`Product not found: ${row.product_id}`);
            }
          } else if (row.type === 'OPTION' && row.product_id && row.group_id && row.option_id) {
            // Update option price delta
            const product = products.find(p => p.id === row.product_id);
            if (product) {
              const group = product.groups.find(g => g.id === row.group_id);
              if (group) {
                const option = group.options.find(o => o.id === row.option_id);
                if (option) {
                  option.priceDelta = row.price;
                  
                  await supabase.from('products').update({
                    data: product
                  }).eq('id', row.product_id);
                  
                  success++;
                } else {
                  errors.push(`Option not found: ${row.option_id} in ${row.group_id}`);
                }
              } else {
                errors.push(`Group not found: ${row.group_id} in ${row.product_id}`);
              }
            } else {
              errors.push(`Product not found: ${row.product_id}`);
            }
          } else if (row.type === 'INTERIOR' && row.option_id) {
            // Update interior price
            const interior = interiors.find(i => i.id === row.option_id);
            if (interior) {
              interior.price = row.price;
              
              await supabase.from('drawer_interiors').update({
                price: row.price,
                data: interior
              }).eq('id', row.option_id);
              
              success++;
            } else {
              errors.push(`Interior not found: ${row.option_id}`);
            }
          }
        } catch (err: any) {
          errors.push(`Error updating ${row.type} ${row.option_id || row.product_id}: ${err.message}`);
        }
      }

      setImportResult({ success, errors });
      
      // Refresh the catalog
      await refreshCatalog();

    } catch (err: any) {
      setImportResult({ success: 0, errors: [`Failed to parse CSV: ${err.message}`] });
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Pricing CSV Import/Export</h2>
        <p className="text-zinc-400">Download pricing as CSV, edit in Excel/Sheets, then upload to update prices in bulk.</p>
      </div>

      {/* Download Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-green-400">↓</span> Export Pricing
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Download all product base prices, option prices, and drawer interior prices as a CSV file.
        </p>
        <button
          onClick={handleDownload}
          className="bg-green-600 text-white font-bold px-6 py-3 rounded hover:bg-green-500"
        >
          Download Pricing CSV
        </button>
        <p className="text-xs text-zinc-500 mt-3">
          Contains {products?.length || 0} products, {products?.reduce((sum, p) => sum + p.groups.reduce((gs, g) => gs + (g.options?.length || 0), 0), 0) || 0} options, and {interiors?.length || 0} drawer interiors.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-amber-400">↑</span> Import Pricing
        </h3>
        <p className="text-sm text-zinc-400 mb-4">
          Upload a modified CSV to update prices. Only the <code className="text-amber-500">price</code> column will be used - other columns are for reference.
        </p>
        
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            disabled={importing}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className={`bg-amber-500 text-black font-bold px-6 py-3 rounded cursor-pointer hover:bg-amber-400 ${importing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {importing ? 'Importing...' : 'Upload CSV File'}
          </label>
        </div>

        {/* Import Results */}
        {importResult && (
          <div className={`mt-4 p-4 rounded ${importResult.errors.length > 0 ? 'bg-amber-900/20 border border-amber-500/30' : 'bg-green-900/20 border border-green-500/30'}`}>
            <div className="font-bold text-white mb-2">
              Import Complete: {importResult.success} prices updated
            </div>
            {importResult.errors.length > 0 && (
              <div className="mt-2">
                <div className="text-amber-400 text-sm font-bold mb-1">Warnings/Errors ({importResult.errors.length}):</div>
                <ul className="text-xs text-zinc-400 space-y-1 max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {importResult.errors.length > 10 && (
                    <li className="text-zinc-500">...and {importResult.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h3 className="font-bold text-white mb-4">CSV Format</h3>
        <div className="text-sm text-zinc-400 space-y-2">
          <p><strong className="text-white">Columns:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><code className="text-amber-500">type</code> - BASE_PRICE, OPTION, or INTERIOR</li>
            <li><code className="text-amber-500">product_id</code> - Product identifier</li>
            <li><code className="text-amber-500">product_name</code> - For reference only</li>
            <li><code className="text-amber-500">group_id</code> - Option group identifier</li>
            <li><code className="text-amber-500">group_name</code> - For reference only</li>
            <li><code className="text-amber-500">option_id</code> - Option identifier</li>
            <li><code className="text-amber-500">option_name</code> - For reference only</li>
            <li><code className="text-amber-500">code</code> - Product/option code</li>
            <li><code className="text-amber-500 font-bold">price</code> - The price value (this is what gets updated)</li>
          </ul>
          <p className="mt-4 text-zinc-500">
            <strong>Note:</strong> Prices are in AUD wholesale. Public prices will have markup applied automatically.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PricingCSV;
