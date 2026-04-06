/* logic_frecuencias.js */
document.addEventListener('DOMContentLoaded', () => {
    const EXCEL_PATH = 'Frecuencias Peru.xlsx';
    let map;
    let miniMap; // Para el mapa interno del modal
    let allMarkers = [];
    let originalData = [];
    let allGroups = {}; // Almacén global para recuperar datos de ICAO desde la tabla

    // 1. Inicializar Mapa (Centrado en Perú)
    function initMap() {
        console.log('Iniciando mapa...');
        if (typeof L === 'undefined') {
            setTimeout(initMap, 500);
            return;
        }

        // Definición de Capas Base
        const standardMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 });
        const satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Esri Satellite'
        });
        const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: 'OpenTopoMap'
        });

        map = L.map('map', {
            zoomControl: true,
            maxZoom: 18,
            minZoom: 5,
            layers: [standardMap]
        }).setView([-9.19, -75.01], 6);

        const baseLayers = {
            "🗺️ MAPA ESTÁNDAR": standardMap,
            "🛰️ VISTA SATÉLITE": satelliteMap,
            "⛰️ RELIEVE ANDINO": topoMap
        };

        L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

        setTimeout(() => {
            map.invalidateSize();
            console.log('Mapa renderizado y tamaño validado.');
        }, 800);

        // Añadir botón de "Resetear Vista" (debajo del zoom)
        const resetControl = L.control({ position: 'topleft' });
        resetControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            div.innerHTML = `
                <a href="#" title="Resetear Vista" role="button" aria-label="Resetear Vista" style="background:#fff; width:34px; height:34px; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="#000"><path d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm0 6a2 2 0 1 1 2-2 2 2 0 0 1-2 2zM12 18c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6zm0-10c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zM7 12H5c0-3.9 3.1-7 7-7v2c-2.8 0-5 2.2-5 5zm5-7c3.9 0 7 3.1 7 7h-2c0-2.8-2.2-5-5-5V5zm5 7c0 3.9-3.1 7-7 7v-2c2.8 0 5-2.2 5-5h2zm-7 7c-3.9 0-7-3.1-7-7h2c0 2.8 2.2 5 5 5v2z" fill="#000"/></svg>
                </a>
            `;
            div.onclick = (e) => {
                e.preventDefault();
                if (allMarkers.length > 0) {
                    const group = L.featureGroup(allMarkers);
                    map.fitBounds(group.getBounds(), { padding: [30, 30] });
                    
                    // Si el zoom resultante es muy pequeño (lejano), forzar a nivel 6
                    if (map.getZoom() < 6) {
                        map.setZoom(6);
                    }
                } else {
                    map.setView([-9.19, -75.01], 6);
                }
            };
            return div;
        };
        resetControl.addTo(map);
    }

    // 2. Cargar y Procesar Datos de Excel
    async function loadExcelData() {
        const statusBar = document.getElementById('data-status');
        try {
            const response = await fetch(EXCEL_PATH);
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            originalData = json;
            renderDynamicTable(json);
            plotMarkers(json);
            
            const statusText = document.getElementById('data-status-text');
            if (statusText) statusText.innerText = 'SISTEMA OPERATIVO - DATOS CARGADOS';
            document.getElementById('total-count').innerText = json.length;
        } catch (error) {
            console.error('Error al cargar el Excel:', error);
            const statusText = document.getElementById('data-status-text');
            if (statusText) {
                statusText.innerText = 'ERROR: No se pudo cargar el archivo Excel.';
                statusText.parentElement.style.color = '#ff3e3e';
            }
        }
    }

    // 3. Renderizar Tabla Dinámica con Filtros
    function renderDynamicTable(data) {
        const headRow = document.getElementById('table-headers');
        const tableBody = document.getElementById('table-body');
        
        headRow.innerHTML = '';
        tableBody.innerHTML = '';

        if (data.length === 0) return;

        const headers = Object.keys(data[0]).filter(h => {
            const hUpper = h.toUpperCase();
            return !hUpper.startsWith('__EMPTY') && !hUpper.includes('LATITUD') && !hUpper.includes('LONGITUD');
        });
        headers.forEach(header => {
            const th = document.createElement('th');
            // Ajustar anchos específicos según columna (VALORES FORZADOS)
            const h = header.toUpperCase();
            if (h.includes('LATITUD')) {
                th.style.width = '150px';
                th.style.minWidth = '150px';
            } else if (h.includes('LONGITUD')) {
                th.style.width = '150px';
                th.style.minWidth = '150px';
            } else if (h.includes('UBICACION') || h.includes('AEROPUERTO')) {
                th.style.width = '240px';
                th.style.minWidth = '240px';
            } else if (h.includes('ICAO')) {
                th.style.width = '80px';
                th.style.minWidth = '80px';
            } else if (h.includes('FRECUENCIA')) {
                th.style.width = '90px';
                th.style.minWidth = '90px';
            } else if (h.includes('ESTADO')) {
                th.style.width = '90px';
                th.style.minWidth = '90px';
            } else if (h.includes('SERVICIO')) {
                th.style.width = '80px';
                th.style.minWidth = '80px';
            }

            th.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleFilter('${header}')">
                    <span>${header}</span>
                    <span style="font-size:10px; color:#94a3b8;">▼</span>
                </div>
                <div id="filter-${header}" class="filter-dropdown" style="display:none; position:absolute; background:#21262e; border:1px solid #334155; padding:10px; z-index:2000; min-width:180px; border-radius:4px; margin-top:5px; box-shadow:0 10px 30px rgba(0,0,0,0.8);">
                    <input type="text" placeholder="Filtrar..." onkeyup="filterColumn('${header}', this.value)" style="width:100%; background:#0f1115; border:1px solid #334155; color:#fff; padding:6px; font-size:11px; margin-bottom:8px; border-radius:3px; outline:none;">
                    <div id="options-${header}" style="max-height:150px; overflow-y:auto; font-size:11px; color:#94a3b8;"></div>
                    <div class="filter-actions">
                        <button class="btn-text" onclick="window.resetOneFilter('${header}', event)">Limpiar</button>
                        <button class="btn-text btn-text-red" onclick="window.closeAllFilters(event)">Cerrar</button>
                    </div>
                </div>
            `;
            headRow.appendChild(th);
            populateFilterOptions(header, originalData);
        });

        renderRows(data);
    }

    function renderRows(data) {
        const tableBody = document.getElementById('table-body');
        tableBody.innerHTML = '';
        
        if (data.length === 0) return;
        const headers = Object.keys(data[0]).filter(h => {
            const hUpper = h.toUpperCase();
            return !hUpper.startsWith('__EMPTY') && !hUpper.includes('LATITUD') && !hUpper.includes('LONGITUD');
        });

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.style.cursor = 'pointer'; // Indicador visual de clic

            headers.forEach(header => {
                const td = document.createElement('td');
                const h = header.toUpperCase();
                let cellData = row[header] || '-';
                if (typeof cellData === 'string') {
                    // Reemplazar saltos de línea por espacios y quitar espacios múltiples superpuestos
                    cellData = cellData.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
                }
                td.innerText = cellData;

                // Aplicar color celeste cian a columnas de DATOS TÉCNICOS
                if (h.includes('FRECUENCIA') || h.includes('LATITUD') || h.includes('LONGITUD') || h.includes('ESTADO') || h.includes('ICAO')) {
                    td.style.color = '#7dd3fc';
                    td.style.fontWeight = '700';
                }
                
                tr.appendChild(td);
            });

            // ACCIÓN AL HACER CLIC EN LA FILA
            tr.onclick = () => {
                const icao = row['CODIGO ICAO'] || row['icao'] || 'S/I';
                const group = allGroups[icao];
                if (group) {
                    // Abrir Únicamente el Modal
                    openModal(icao, group);
                }
            };

            tableBody.appendChild(tr);
        });
        document.getElementById('total-count').innerText = data.length;
    }

    // 4. Lógica de Filtrado Transversal
    window.toggleFilter = (header) => {
        const dropdown = document.getElementById(`filter-${header}`);
        const isShown = dropdown.style.display === 'block';
        // Cerrar todos los demás
        document.querySelectorAll('.filter-dropdown').forEach(d => d.style.display = 'none');
        dropdown.style.display = isShown ? 'none' : 'block';
    };

    window.closeAllFilters = (e) => {
        if (e) e.stopPropagation();
        document.querySelectorAll('.filter-dropdown').forEach(d => d.style.display = 'none');
    };

    window.resetOneFilter = (header, e) => {
        if (e) e.stopPropagation();
        const input = document.querySelector(`#filter-${header} input`);
        if (input) input.value = '';
        renderRows(originalData);
        plotMarkers(originalData);
        window.closeAllFilters();
    };

    window.filterColumn = (header, value) => {
        const filtered = originalData.filter(row => {
            const cellValue = String(row[header] || '').toLowerCase();
            return cellValue.includes(value.toLowerCase());
        });
        renderRows(filtered);
        plotMarkers(filtered);
        document.getElementById('btn-reset').style.display = 'block';
    };

    function populateFilterOptions(header, data) {
        const optionsDiv = document.getElementById(`options-${header}`);
        const uniqueValues = [...new Set(data.map(item => item[header]))].sort();
        
        uniqueValues.forEach(val => {
            if (!val) return;
            const item = document.createElement('div');
            item.style.padding = '4px 0';
            item.style.cursor = 'pointer';
            item.innerText = val;
            item.onclick = () => {
                filterColumn(header, String(val));
                document.getElementById(`filter-${header}`).style.display = 'none';
            };
            optionsDiv.appendChild(item);
        });
    }

    document.getElementById('btn-reset').onclick = () => {
        renderRows(originalData);
        plotMarkers(originalData);
        document.getElementById('btn-reset').style.display = 'none';
        document.querySelectorAll('.filter-dropdown input').forEach(i => i.value = '');
    };

    // 4. Dibujar Puntos en el Mapa (con soporte para GMS)
    function dmsToDecimal(dmsStr) {
        if (!dmsStr || typeof dmsStr !== 'string') return parseFloat(dmsStr);
        
        // Limpiar el string de espacios y caracteres raros
        const cleanStr = dmsStr.trim().replace(/’/g, "'").replace(/”/g, '"').replace(/º/g, "°");
        
        // Regex para capturar grados, minutos, segundos y dirección
        const regex = /(\d+)\D+(\d+)\D+([\d\.]+)\D+([NSEWnsew])/;
        const parts = cleanStr.match(regex);
        
        if (!parts) return parseFloat(dmsStr); // Si ya es decimal, devolverlo tal cual

        const degrees = parseFloat(parts[1]);
        const minutes = parseFloat(parts[2]);
        const seconds = parseFloat(parts[3]);
        const direction = parts[4].toUpperCase();

        let decimal = degrees + (minutes / 60) + (seconds / 3600);

        if (direction === 'S' || direction === 'W') {
            decimal = decimal * -1;
        }

        return decimal;
    }

    function plotMarkers(data) {
        allMarkers.forEach(m => map.removeLayer(m));
        allMarkers = [];
        allGroups = {}; // Reiniciar grupos al redibujar

        // 1. Agrupar datos por ICAO en el almacén global
        data.forEach(row => {
            const icao = row['CODIGO ICAO'] || row['icao'] || 'S/I';
            if (!allGroups[icao]) {
                allGroups[icao] = {
                    info: row,
                    count: 0,
                    frecuencias: []
                };
            }
            allGroups[icao].count++;
            allGroups[icao].frecuencias.push(row);
        });

        // 2. Dibujar pines por cada grupo
        Object.keys(allGroups).forEach(icao => {
            const group = allGroups[icao];
            const lat = dmsToDecimal(group.info['LATITUD'] || group.info['latitud']);
            const lon = dmsToDecimal(group.info['LONGITUD'] || group.info['longitud']);

            if (!isNaN(lat) && !isNaN(lon)) {
                // Crear icono con número central
                const customIcon = L.divIcon({
                    html: `<div style="
                        background: #facc15; 
                        width: 24px; 
                        height: 24px; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        color: #000; 
                        font-weight: 800; 
                        font-size: 13px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    ">${group.count}</div>`,
                    className: 'custom-icao-marker',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map);

                // 5. FILTRADO DESDE EL MAPA (Interacción por clic)
                marker.on('click', () => {
                    // Filtrar la tabla de la derecha para mostrar solo este grupo
                    renderRows(group.frecuencias);
                    
                    // Mostrar el botón de resetear filtros
                    const btnReset = document.getElementById('btn-reset');
                    if (btnReset) btnReset.style.display = 'flex';
                    
                    // Actualizar contador
                    document.getElementById('total-count').innerText = group.frecuencias.length;
                    
                    // Efecto visual opcional: Zoom leve
                    const lat = dmsToDecimal(group.info['LATITUD'] || group.info['latitud']);
                    const lon = dmsToDecimal(group.info['LONGITUD'] || group.info['longitud']);
                    map.flyTo([lat, lon], 9, { duration: 1.0 });
                });
                
                allMarkers.push(marker);
            }
        });
    }

    // 5. Gestión del Modal
    window.openModal = (icao, group) => {
        const overlay = document.getElementById('modal-overlay');
        const body = document.getElementById('modal-body');

        // Buscador robusto de nombre de aeropuerto
        const findName = (obj) => {
            const keys = Object.keys(obj);
            const targetKey = keys.find(k => {
                const upper = k.toUpperCase();
                return upper.includes('AEROPUERTO') || upper.includes('UBICACION');
            });
            return targetKey ? obj[targetKey] : 'ESTACIÓN DESCONOCIDA';
        };

        const airportName = findName(group.info);
        const lat = dmsToDecimal(group.info['LATITUD'] || group.info['latitud']);
        const lon = dmsToDecimal(group.info['LONGITUD'] || group.info['longitud']);
        
        let content = `
            <div class="modal-layout-dual">
                <!-- PANEL IZQUIERDO: MAPA DE APROXIMACIÓN -->
                <div>
                     <div style="padding-bottom:12px; margin-bottom:15px;">
                        <div style="color:#facc15; font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:1px; line-height:1.2;">
                            Mapa de Aproximación
                        </div>
                    </div>
                    <div id="mini-map" style="height:480px; width:100%; border-radius:8px; border:1px solid #334155; background:#000;"></div>
                </div>

                <!-- PANEL DERECHO: FICHA TÉCNICA -->
                <div>
                    <div style="padding-bottom:12px; margin-bottom:15px;">
                        <div style="color:#facc15; font-size:18px; font-weight:900; text-transform:uppercase; letter-spacing:1px; line-height:1.2;">
                            ${airportName}
                        </div>
                        <div style="background:rgba(125,211,252,0.05); padding:8px 15px; border-left:4px solid #7dd3fc; border-radius:4px; margin-top:5px;">
                            <div style="color:#94a3b8; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">CÓDIGO ICAO: <span style="color:#facc15;">${icao}</span></div>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1.2fr 1fr 0.8fr; gap:15px; border-bottom:1px solid #334155; padding-bottom:10px; margin-bottom:10px; color:#94a3b8; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px;">
                        <div>Tipo de Servicio</div>
                        <div>Frecuencia MHz</div>
                        <div>Estado Operativo</div>
                    </div>

                    <div class="modal-body-scroll" style="max-height:360px;">
        `;

        group.frecuencias.forEach(f => {
            const isEnUso = String(f['ESTADO']).toLowerCase().includes('uso');
            content += `
                <div style="display:grid; grid-template-columns: 1.2fr 1fr 0.8fr; gap:15px; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05); align-items:center;">
                    <div style="font-size:14px; font-weight:700; color:#fff;">${f['SERVICIO'] || '-'}</div>
                    <div style="font-size:15px; font-weight:900; color:#7dd3fc; font-family:'Roboto Mono', monospace;">${f['FRECUENCIA'] || '-'}</div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div style="width:8px; height:8px; border-radius:50%; background:${isEnUso ? '#10b981' : '#ef4444'}; box-shadow:0 0 8px ${isEnUso ? '#10b981' : '#ef4444'};"></div>
                        <div style="font-size:11px; font-weight:800; color:${isEnUso ? '#ffffff' : '#ef4444'}; text-transform:uppercase;">
                            ${f['ESTADO'] || '-'}
                        </div>
                    </div>
                </div>
            `;
        });

        content += `
                    </div>
                    <div style="margin-top:20px; padding-top:15px; border-top:1px solid #334155; font-size:12px; color:#facc15; text-align:right; font-family:monospace; font-weight:900; background:rgba(0,0,0,0.3); padding:10px; border-radius:4px;">
                        <span style="color:#94a3b8; font-size:10px; letter-spacing:1px; margin-right:5px;">GEOPOSICIÓN:</span> ${group.info['LATITUD']} / ${group.info['LONGITUD']}
                    </div>
                </div>
            </div>
        `;

        body.innerHTML = content;
        overlay.style.display = 'flex';

        // Inicializar Mini-Mapa después de renderizar el modal
        setTimeout(() => {
            if (miniMap) { miniMap.remove(); }
            miniMap = L.map('mini-map', { zoomControl: false, attributionControl: false }).setView([lat, lon], 14);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap);
            L.circleMarker([lat, lon], { radius:12, fillColor:"#facc15", color:"#fff", weight:2, opacity:1, fillOpacity:0.8 }).addTo(miniMap);
            miniMap.invalidateSize();
        }, 300);
    };

    window.closeModal = (e) => {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('modal-overlay').style.display = 'none';
        if (miniMap) {
            miniMap.remove();
            miniMap = null;
        }
    };

    // Ejecución inicial
    initMap();
    loadExcelData();

    // Evento del botón Limpiar Filtros
    document.getElementById('btn-reset').addEventListener('click', () => {
        // Restaurar la tabla completa
        renderRows(originalData);
        // Ocultar botón
        document.getElementById('btn-reset').style.display = 'none';
        // El mapa se resetea por una función previa en initMap (pero vamos a llamar específicamente al reset del mapa si es necesario)
        if (allMarkers.length > 0) {
            const group = L.featureGroup(allMarkers);
            map.fitBounds(group.getBounds(), { padding: [30, 30] });
            if (map.getZoom() < 6) map.setZoom(6);
        } else {
            map.setView([-9.19, -75.01], 6);
        }
    });
});
