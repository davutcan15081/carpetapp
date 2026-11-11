# Halı Görselleştirme (carpetapp)

Tarayıcıda çalışan, bağımlılıksız bir **halı görselleştirme aracı**. Kullanıcı kendi oda fotoğrafını ve bir halı desenini yükler, halının 4 köşesini sürükleyerek zemindeki perspektife oturtur ve sonucu tek tıkla odanın üzerine uygular. Web sitelerine / e-ticaret sayfalarına `iframe` ile gömülebilir.

> Saf HTML + CSS + Vanilla JavaScript. Build adımı, paket yöneticisi veya harici kütüphane yoktur.

## Ne yapar?

1. **Oda görüntüsü yükle** – oda fotoğrafı canvas'a sığacak şekilde (en fazla 1140×600) ölçeklenir.
2. **Halı görüntüsü yükle** – halı deseni odanın ortasında, 4 köşe tutamaçlı bir katman olarak belirir.
3. **Perspektifi ayarla** – köşeleri sürükleyin, halı gerçek zamanlı olarak bükülür; poligonun içine tıklayıp sürükleyerek tüm halıyı taşıyabilirsiniz.
4. **Halıyı uygula** – bükülmüş halı oda görüntüsüne kalıcı olarak işlenir.
5. **Sıfırla** – her şeyi temizler.

## Hızlı başlangıç

Dosyaları doğrudan açabilirsiniz (`index.html`). Gömme modu ve `postMessage` API'si için bir web sunucusu gerekir (`file://` üzerinde iframe iletişimi çalışmaz):

```bash
python -m http.server 8000
# veya
npx http-server -p 8000
```

Ardından `http://localhost:8000` adresini açın.

## Nasıl çalışır?

Perspektif bükme `app.js` içindeki `CarpetApp` sınıfında yapılır:

- Halı resmi, 4 köşe noktasıyla tanımlanan bir dörtgene **homografi (perspektif dönüşümü)** ile eşlenir (`calculateHomography`, `solveLinearSystem`, `applyHomographyInverse`).
- Önizleme sırasında `drawPerspectiveCarpet` dörtgenin içindeki her piksel için ters dönüşümle halı resminden renk örnekler.
- **Halıyı Uygula** denildiğinde sonuç canvas'a işlenir ve `originalImageData` güncellenerek kalıcı hale getirilir.

## Dosya yapısı

```
carpetapp/
├── index.html   # Arayüz (yükleme butonları, canvas, kontroller, durum çubuğu)
├── styles.css   # Stiller ve CSS değişkenleri (tema renkleri)
├── app.js       # Uygulama mantığı: canvas, perspektif, embed/postMessage
└── README.md
```

## Web sitesine gömme

```html
<iframe src="https://siteniz.com/carpetapp/index.html?embed=true"
        width="100%" height="600" frameborder="0"></iframe>
```

### URL parametreleri

| Parametre | Açıklama |
|---|---|
| `embed=true` | Gömme modu (kompakt, şeffaf arka plan) |
| `primaryColor=%23ff5722` | Ana rengi değiştirir |
| `hideHeader=true` | Başlığı gizler |
| `hideStatus=true` | Durum çubuğunu gizler |
| `compact=true` | Boşlukları azaltır |
| `lang=tr` | Dil ayarı (şu an yalnızca yapılandırmada tutuluyor, arayüz metinleri Türkçe) |

### postMessage API

Üst sayfadan uygulamaya gönderilebilen mesajlar:

| `type` | `data` | Açıklama |
|---|---|---|
| `setRoomImage` | `{ url }` | Oda görüntüsünü URL'den yükler |
| `setCarpetImage` | `{ url }` | Halı görüntüsünü URL'den yükler |
| `setSelectionPoints` | `{ points: [{x,y}, ...] }` | Seçim noktalarını ayarlar |
| `applyCarpet` | `{}` | Halıyı uygular |
| `exportImage` | `{}` | Canvas'ı PNG data URL olarak döndürür |
| `setTheme` | `{ primaryColor, secondaryColor, successColor, dangerColor }` | Tema renkleri |
| `getConfig` | `{}` | Mevcut yapılandırmayı döndürür |
| `reset` | `{}` | Uygulamayı sıfırlar |

Uygulamanın üst sayfaya gönderdiği mesajlar: `roomImageLoaded`, `carpetImageLoaded`, `imageExported`, `config`.

```js
const iframe = document.querySelector('iframe');

iframe.contentWindow.postMessage(
  { type: 'setRoomImage', data: { url: 'https://example.com/room.jpg' } }, '*');

window.addEventListener('message', (e) => {
  if (e.data.type === 'imageExported' && e.data.success) {
    console.log(e.data.dataUrl); // PNG data URL
  }
});
```

> **Not:** `exportImage` canvas'ı dışa aktarır; harici bir URL'den yüklenen görüntüler CORS izni vermiyorsa tarayıcı canvas'ı "tainted" sayar ve dışa aktarma hata döner. Görselleri aynı alan adından veya CORS başlığıyla sunun.

## Teknolojiler

HTML5 Canvas API · CSS3 (değişkenler, responsive) · Vanilla JavaScript (ES6 sınıfları)

## Bilinen sınırlamalar

- Tek halı katmanı desteklenir; halı uygulandıktan sonra geri alma yoktur (yalnızca **Sıfırla**).
- Dönüşüm piksel piksel CPU üzerinde yapıldığından çok büyük görsellerde önizleme yavaşlayabilir.
- Dokunmatik (touch) olayları yoktur; etkileşim fare olaylarına dayanır.

## Lisans

Henüz bir lisans dosyası eklenmedi. Paylaşım/kullanım koşullarını belirlemek için `LICENSE` ekleyin (ör. MIT).
