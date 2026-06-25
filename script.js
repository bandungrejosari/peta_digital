// 1. Buat Peta
let map = L.map('map').setView([-8.006657, 112.618495], 15);


const TombolPencarian = L.Control.extend({
    options: {
        position: 'topleft' // Menempatkan tombol di kiri atas, berdekatan dengan tombol zoom
    },
    onAdd: function (map) {
        // Membuat wadah untuk tombol dengan kelas bawaan Leaflet agar rapi
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');

        // Mendesain tombol agar terlihat menyatu dengan gaya Leaflet
        container.innerHTML = `
            <button onclick="cariTerdekat()" style="background-color: white; color: #333; border: none; padding: 8px 12px; cursor: pointer; font-weight: bold; border-radius: 4px; display: flex; align-items: center; gap: 5px;">
                Cari UMKM Terdekat
            </button>
        `;

        // Mencegah peta ikut terklik atau bergeser saat tombol ini ditekan
        L.DomEvent.disableClickPropagation(container);

        return container;
    }
});

// Masukkan tombol ke dalam peta
map.addControl(new TombolPencarian());

// Wadah untuk daftar UMKM
let daftarUMKM = [];

// 2. Tampilan OpenStreetMap
L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        attribution: '&copy; OpenStreetMap contributors'
    }
).addTo(map);

// 3. Icon Kuliner
let foodIcon = L.icon({
    iconUrl: 'Food.png',
    iconSize: [30,30]
});

// 4. Marker Statis Kantor Kelurahan
L.marker([-8.0070465, 112.6184146])
    .addTo(map)
    .bindPopup("Kantor Kel. Bandungrejosari")
    .openPopup();

// 5. Membaca Data Google Sheet
const sheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS1UCtxXlzMVz3AUDdIpmyT7lcO7sUXq4Kn9woEfU8rY2U9qS7XLhmjS4Sc3W6n8T-aqFTLnkzdbwPL/pub?output=csv';

Papa.parse(sheetUrl, {
    download: true,
    header: true,
    complete: function(results) {
        console.log("Data Sheet:", results.data);

        // SATUKAN PROSES DI SINI
        results.data.forEach(function(umkm){
            if(umkm.Lat && umkm.Long){
                
                // Ubah koordinat jadi angka
                const lat = parseFloat(umkm.Lat.replace(',', '.'));
                const lon = parseFloat(umkm.Long.replace(',', '.'));
                
                // Foto Array
                const fotoArray = umkm.URL
                .split(",")
                .map(f => f.trim())
                .slice(0, 5);

                let galeri = "";

                fotoArray.forEach(function(link){   
                        galeri += `
                            <img
                                src="${link}"
                                style="
                                    width:250px;
                                    height:180px;
                                    object-fit:cover;
                                    border-radius:8px;
                                    flex-shrink:0;
                                "
                            >
                        `;
                    });

                // Buat marker dengan icon, foto, dan link
                const marker = L.marker([lat, lon], {icon : foodIcon})
            .addTo(map)
            .bindPopup(`
                <div class="popup-title">
                   ${umkm.NamaUsaha}
                </div>

                <div class="popup-category">
                    (${umkm.Jenis})
                </div>
               

                <div class="popup-content">
                <b>Hari Buka:</b><br>
                ${umkm.Hari_buka || "-"}<br>

                <b>Jam Operasional:</b>
                ${umkm.Jam_opr || "-"}<br> </div>

                <div style="
                    display:flex;
                    overflow-x:auto;
                    gap:10px;
                ">
                    ${galeri}
                </div>

                <br>

                <a href="${umkm.Gmaps}" target="_blank">
                    📍 Lihat di Google Maps
                </a>

                ${umkm.LinkWA ? `
                    <br><br>
                    <a href="${umkm.LinkWA}" target="_blank">
                        📞 Pesan Sekarang
                    </a>
                ` : ""}
            `);
    

                // Simpan data ke dalam array untuk dihitung jaraknya nanti
                daftarUMKM.push({
                    Nama: umkm.NamaUsaha,
                    Lat: lat,
                    Lon: lon,
                    marker: marker
                });
            }
        });
    }
});



function cariTerdekat() {
    if (!navigator.geolocation) {
        alert("Browser Anda tidak mendukung fitur lokasi.");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        function (pos) {
            const userLat = pos.coords.latitude;
            const userLon = pos.coords.longitude;

            daftarUMKM.forEach(function (umkm) {
                const latFloat = parseFloat(String(umkm.Lat).replace(',', '.'));
                const lonFloat = parseFloat(String(umkm.Lon).replace(',', '.'));

                // Menghitung jarak pengguna dengan tiap UMKM
                umkm.jarak = hitungJarak(userLat, userLon, latFloat, lonFloat);
            });

            // Urutkan dari yang paling dekat
            daftarUMKM.sort((a, b) => a.jarak - b.jarak);

            tampilkanDaftar();
        },
        function (error) {
            alert("Gagal mengambil lokasi: " + error.message);
        }
    );
}

function tampilkanDaftar() {
    let html = "<h3>UMKM Terdekat</h3>";
    console.log("Daftar terurut:", daftarUMKM);

    daftarUMKM.slice(0, 5).forEach(function (umkm) {
        html += `
        <div onclick="zoomUMKM('${umkm.Nama}')" style="cursor: pointer; padding: 5px; border-bottom: 1px solid #ccc;">
            ${umkm.Nama} 
            (${umkm.jarak.toFixed(2)} km)
        </div>
        `;
    });

    L.popup({
        maxWidth: 300
    })
    .setLatLng(map.getCenter())
    .setContent(html)
    .openOn(map);
}

function zoomUMKM(nama) {
    const umkm = daftarUMKM.find(x => x.Nama === nama);

    if (umkm) {
        const latFloat = parseFloat(String(umkm.Lat).replace(',', '.'));
        const lonFloat = parseFloat(String(umkm.Lon).replace(',', '.'));

        map.setView([latFloat, lonFloat], 18);

        if (umkm.marker) {
            umkm.marker.openPopup();
        }
    }
}

// WAJIB ADA: Rumus matematika untuk menghitung jarak di peta
function hitungJarak(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius bumi dalam kilometer
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; 
}