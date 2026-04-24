const XLSX = require('xlsx');
const path = require('path');

const filename = 'Perú V.1.xlsx';
const filePath = path.join(__dirname, '..', filename);

try {
    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const json = XLSX.utils.sheet_to_json(worksheet);
    console.log(`Successfully read ${filename}`);
    console.log(`Number of rows: ${json.length}`);
    if (json.length > 0) {
        console.log('Columns:', Object.keys(json[0]));
        const hasEstado = json.some(row => row['Estado'] || row['ESTADO']);
        console.log('Has "Estado" column anywhere?', hasEstado);
        console.log('Sample rows:', json.slice(0, 5));
    }
} catch (error) {
    console.error(`Error reading ${filename}:`, error.message);
}
