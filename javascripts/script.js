const upload = document.getElementById("upload");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const mostFrequentColorDisplay = document.getElementById("mostFrequentColor");
const contrastColorsDisplay = document.getElementById("contrastColors");
const searchBtnUpper = document.getElementById("search-btn-upper");
const searchBtnJeans = document.getElementById("search-btn-jeans");
const searchBtnlower = document.getElementById("search-btn-lower");
const color1 = document.getElementById("color1");
const color2 = document.getElementById("color2");
const color3 = document.getElementById("color3");
const color4 = document.getElementById("color4");
const dropZone = document.getElementById("drop-zone");
let jeansGot;
let upperGot;
let lowerGot;
let jeans_image_filtered;
let upper_image_filtered;
let lower_image_filtered;
let contrastColor;
let mostFrequentColor = null;
let c1;
let c2;
let c3;
let c4;

// ... existing code ...

// Retrieve shop name from the URL
const urlParts = window.location.pathname.split('/');
const shopName = urlParts[1];


// Calculate inverted contrast color
function calculateContrastColor(rgb, generatePalette = false) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);

  // Calculate perceived brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Remove any existing message first
  let existingMessage = document.querySelector(".contrast-message");
  if (existingMessage) {
    existingMessage.remove();
  }

  if (brightness > 128) {
    // Create and add the message for light colors
    const message = document.createElement("p");
    message.className = "contrast-message";
    message.style.color = "var(--font-color)";
    message.style.marginTop = "5px";
    message.style.fontSize = "14px";
    message.innerHTML =
      '<i class="fas fa-info-circle"></i> Black could be considered!';

    // Insert after contrastColorsDisplay
    contrastColorsDisplay.parentNode.insertBefore(
      message,
      contrastColorsDisplay.nextSibling
    );
  }

  // Original contrast color calculation remains unchanged
  contrastColor = `rgb(${255 - r}, ${255 - g}, ${255 - b})`;

  if (generatePalette) {
    getCustomRGBPalette(r, g, b);
  }

  return contrastColor;
}

// Handle file selection from input field
upload.addEventListener("change", handleFileSelect);

// Handle click on drop zone to trigger the file input click event
dropZone.addEventListener("click", () => {
  upload.click();
});

// Handle dragover to allow dropping
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

// Handle dragleave to remove dragover style
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

// Handle the drop event to process the image file
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files[0];
  if (file) {
    handleFileSelect({ target: { files: [file] } });
  }
});

function handleFileSelect(e) {
  const img = new Image();
  const file = e.target.files[0];
  img.src = URL.createObjectURL(file);

  img.onload = () => {
    // Stop camera if it's running
    if (stream) {
      const track = stream.getVideoTracks()[0];
      track.stop();
      stream = null;
      cameraPreview.style.display = "none";
      cameraBtn.innerHTML = '<i class="fas fa-camera"></i> Take Photo';
      cameraBtn.style.display = "inline-block";
      retakeBtn.style.display = "inline-block";
    }

    dropZone.innerHTML = "";
    dropZone.appendChild(img);

    const newWidth = 200;
    const newHeight = Math.round((img.height / img.width) * newWidth);
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Separate color counts for different regions
    const centerColors = new Map();
    const middleColors = new Map();
    const outerColors = new Map();

    // Define sampling regions with weights
    const regions = [
      // Center region (reduced weight)
      {
        x: Math.floor(newWidth * 0.4),
        y: Math.floor(newHeight * 0.4),
        width: Math.floor(newWidth * 0.2),
        height: Math.floor(newHeight * 0.2),
        weight: 2, // Reduced from 5
        colorMap: centerColors,
      },
      // Middle region (increased weight and size)
      {
        x: Math.floor(newWidth * 0.25),
        y: Math.floor(newHeight * 0.25),
        width: Math.floor(newWidth * 0.5),
        height: Math.floor(newHeight * 0.5),
        weight: 4, // Increased from 3
        colorMap: middleColors,
      },
      // Outer region
      {
        x: Math.floor(newWidth * 0.1),
        y: Math.floor(newHeight * 0.1),
        width: Math.floor(newWidth * 0.8),
        height: Math.floor(newHeight * 0.8),
        weight: 1,
        colorMap: outerColors,
      },
    ];

    const isWhiteShade = (r, g, b) => {
      return r > 230 && g > 230 && b > 230;
    };

    // Color quantization helper
    const quantizeColor = (r, g, b) => {
      const quantum = 16;
      return {
        r: Math.round(r / quantum) * quantum,
        g: Math.round(g / quantum) * quantum,
        b: Math.round(b / quantum) * quantum,
      };
    };

    // Check if colors are similar (within 15% difference)
    const areSimilarColors = (color1, color2) => {
      const [r1, g1, b1] = color1.match(/\d+/g).map(Number);
      const [r2, g2, b2] = color2.match(/\d+/g).map(Number);
      const threshold = 0.15; // 15% difference threshold

      return (
        Math.abs(r1 - r2) / 255 <= threshold &&
        Math.abs(g1 - g2) / 255 <= threshold &&
        Math.abs(b1 - b2) / 255 <= threshold
      );
    };

    // Add color clustering function before combining results
    const clusterSimilarColors = (colorMap) => {
      const clusters = new Map();

      colorMap.forEach((count, color) => {
        const [r, g, b] = color.match(/\d+/g).map(Number);
        let foundCluster = false;

        for (const [clusterColor, clusterCount] of clusters) {
          const [cr, cg, cb] = clusterColor.match(/\d+/g).map(Number);
          const colorDistance = Math.sqrt(
            Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2)
          );

          if (colorDistance < 30) {
            // Adjust threshold as needed
            clusters.set(clusterColor, clusterCount + count);
            foundCluster = true;
            break;
          }
        }

        if (!foundCluster) {
          clusters.set(color, count);
        }
      });

      return clusters;
    };

    // Process each region separately
    regions.forEach((region) => {
      const imageData = ctx.getImageData(
        region.x,
        region.y,
        region.width,
        region.height
      ).data;

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];

        // Skip white shades in outer region
        if (region.colorMap === outerColors && isWhiteShade(r, g, b)) {
          continue;
        }

        const quantized = quantizeColor(r, g, b);
        const colorKey = `rgb(${quantized.r}, ${quantized.g}, ${quantized.b})`;

        region.colorMap.set(
          colorKey,
          (region.colorMap.get(colorKey) || 0) + region.weight
        );
      }
    });

    // Update the color combination logic
    // Replace the existing combinedColors logic with:
    const combinedColors = new Map();

    // Cluster and combine middle region colors first
    const clusteredMiddleColors = clusterSimilarColors(middleColors);
    clusteredMiddleColors.forEach((count, color) => {
      combinedColors.set(color, (combinedColors.get(color) || 0) + count);
    });

    // Add center colors if they're significantly different from existing colors
    const clusteredCenterColors = clusterSimilarColors(centerColors);
    clusteredCenterColors.forEach((count, color) => {
      let isUnique = true;
      for (const [existingColor] of combinedColors) {
        if (areSimilarColors(color, existingColor)) {
          isUnique = false;
          break;
        }
      }
      if (isUnique) {
        combinedColors.set(color, (combinedColors.get(color) || 0) + count);
      }
    });

    // Check for background color in outer region
    const outerColorEntries = [...outerColors.entries()];
    if (outerColorEntries.length > 0) {
      const mostFrequentOuter = outerColorEntries.reduce((a, b) =>
        a[1] > b[1] ? a : b
      )[0];

      // Add outer colors only if they're not similar to the background
      outerColors.forEach((count, color) => {
        if (!areSimilarColors(color, mostFrequentOuter)) {
          combinedColors.set(color, (combinedColors.get(color) || 0) + count);
        }
      });
    }

    // Find the most frequent color
    let mostFrequentColor;

    if (combinedColors.size > 0) {
      // Get the most frequent color from combined results
      mostFrequentColor = [...combinedColors.entries()].reduce(
        ([maxColor, maxCount], [color, count]) =>
          count > maxCount ? [color, count] : [maxColor, maxCount],
        ["rgb(128, 128, 128)", 0]
      )[0];
    } else {
      // If no valid colors found, try middle and center regions only
      const middleCenterColors = new Map([...centerColors, ...middleColors]);
      if (middleCenterColors.size > 0) {
        mostFrequentColor = [...middleCenterColors.entries()].reduce(
          ([maxColor, maxCount], [color, count]) =>
            count > maxCount ? [color, count] : [maxColor, maxCount],
          ["rgb(128, 128, 128)", 0]
        )[0];
      } else {
        mostFrequentColor = "rgb(128, 128, 128)"; // Fallback color
      }
    }

    mostFrequentColorDisplay.style.backgroundColor = mostFrequentColor;
    const contrastColor = calculateContrastColor(mostFrequentColor, true);
    contrastColorsDisplay.style.backgroundColor = contrastColor;

    window.mostFrequentColor = mostFrequentColor;
  };
}

searchBtnJeans.addEventListener("click", () => {
  const currentColor = mostFrequentColorDisplay.style.backgroundColor;
  if (currentColor) {
    document.getElementById("images").innerHTML = "";

    // Get the displayed colors
    const contrastColor = contrastColorsDisplay.style.backgroundColor;
    const color1 = document.getElementById("color1").style.backgroundColor;
    const color2 = document.getElementById("color2").style.backgroundColor;
    const color3 = document.getElementById("color3").style.backgroundColor;
    const color4 = document.getElementById("color4").style.backgroundColor;

    // Search for each color
    findSimilarjeans(color1, color2, color3, color4, contrastColor,20)
  } else {
    alert("Please upload an image and select a color first.");
  }
});

searchBtnUpper.addEventListener("click", () => {
  const currentColor = mostFrequentColorDisplay.style.backgroundColor;
  if (currentColor) {
    document.getElementById("images").innerHTML = "";

    // Get the displayed colors
    const contrastColor = contrastColorsDisplay.style.backgroundColor;
    const color1 = document.getElementById("color1").style.backgroundColor;
    const color2 = document.getElementById("color2").style.backgroundColor;
    const color3 = document.getElementById("color3").style.backgroundColor;
    const color4 = document.getElementById("color4").style.backgroundColor;

    // Search for each color
    findSimilarUppers(color1, color2, color3, color4,contrastColor, 20)
  } else {
    alert("Please upload an image and select a color first.");
  }
});

searchBtnlower.addEventListener("click", () => {
  const currentColor = mostFrequentColorDisplay.style.backgroundColor;
  if (currentColor) {
    document.getElementById("images").innerHTML = "";

    // Get the displayed colors
    const contrastColor = contrastColorsDisplay.style.backgroundColor;
    const color1 = document.getElementById("color1").style.backgroundColor;
    const color2 = document.getElementById("color2").style.backgroundColor;
    const color3 = document.getElementById("color3").style.backgroundColor;
    const color4 = document.getElementById("color4").style.backgroundColor;

    // Search for each color
    findSimilarLowers(color1, color2, color3, color4,contrastColor, 20)
  } else {
    alert("Please upload an image and select a color first.");
  }
});

async function getCustomRGBPalette(r, g, b) {
  try {
    const response = await fetch("http://colormind.io/api/", {
      method: "POST",
      body: JSON.stringify({
        model: "default",
        input: [[r, g, b], "N", "N", "N", "N"],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const palette = data.result;
      c1 = `rgb(${palette[1][0]}, ${palette[1][1]}, ${palette[1][2]})`;
      c2 = `rgb(${palette[2][0]}, ${palette[2][1]}, ${palette[2][2]})`;
      c3 = `rgb(${palette[3][0]}, ${palette[3][1]}, ${palette[3][2]})`;
      c4 = `rgb(${palette[4][0]}, ${palette[4][1]}, ${palette[4][2]})`;
      color1.style.backgroundColor = c1;
      color2.style.backgroundColor = c2;
      color3.style.backgroundColor = c3;
      color4.style.backgroundColor = c4;
    } else {
      console.error("Error fetching color palette:", response.statusText);
    }
  } catch (error) {
    console.error("Request failed:", error);
  }
}

const changePaletteBtn = document.getElementById("change-palette");

changePaletteBtn.addEventListener("click", () => {
  const currentColor = mostFrequentColorDisplay.style.backgroundColor;
  if (currentColor) {
    const [r, g, b] = currentColor.match(/\d+/g).map(Number);
    getCustomRGBPalette(r, g, b);
  } else {
    alert("Please upload an image first.");
  }
});

const cameraBtn = document.getElementById("camera-btn");
const retakeBtn = document.getElementById("retake-btn");
const cameraPreview = document.getElementById("camera-preview");
const cameraCanvas = document.getElementById("camera-canvas");
let stream = null;

// Camera functionality
cameraBtn.addEventListener("click", async () => {
  try {
    if (stream) {
      // If camera is active, take photo
      const track = stream.getVideoTracks()[0];
      track.stop();
      stream = null;
      cameraPreview.style.display = "none";
      cameraBtn.style.display = "none"; // Hide camera button
      retakeBtn.style.display = "inline-block"; // Show retake button

      // Capture the image
      cameraCanvas.width = cameraPreview.videoWidth;
      cameraCanvas.height = cameraPreview.videoHeight;
      const ctx = cameraCanvas.getContext("2d");
      ctx.drawImage(cameraPreview, 0, 0);

      // Convert to file and process
      cameraCanvas.toBlob((blob) => {
        const file = new File([blob], "camera-photo.jpg", {
          type: "image/jpeg",
        });
        handleFileSelect({ target: { files: [file] } });
      }, "image/jpeg");
    } else {
      // Clear drop zone and prepare for camera
      dropZone.innerHTML = "";
      dropZone.appendChild(cameraPreview);

      // Start camera
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      cameraPreview.srcObject = stream;
      cameraPreview.style.display = "block";
      await cameraPreview.play();
      cameraBtn.innerHTML = '<i class="fas fa-camera"></i> Capture';
      retakeBtn.style.display = "none"; // Hide retake button while camera is active
    }
  } catch (err) {
    console.error("Error accessing camera:", err);
    alert(
      "Unable to access camera. Please make sure you have granted camera permissions."
    );
  }
});

// Retake button functionality
retakeBtn.addEventListener("click", async () => {
  try {
    // Clear drop zone and prepare for camera
    dropZone.innerHTML = "";
    dropZone.appendChild(cameraPreview);

    cameraBtn.style.display = "inline-block"; // Show camera button
    retakeBtn.style.display = "none"; // Hide retake button

    // Start camera again
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    cameraPreview.srcObject = stream;
    cameraPreview.style.display = "block";
    await cameraPreview.play();
    cameraBtn.innerHTML = '<i class="fas fa-camera"></i> Capture';
  } catch (err) {
    console.error("Error accessing camera:", err);
    alert(
      "Unable to access camera. Please make sure you have granted camera permissions."
    );
  }
});

  // Function to convert "rgb(r, g, b)" string to an array [r, g, b]
  function rgbStringToArray(rgbString) {
    return rgbString
        .match(/\d+/g)
        .map(Number); // Extracts each number and converts it to an integer
  }
  
  // Function to calculate the Euclidean distance between two RGB rgbs
  function colorDistance(rgb1, rgb2) {
    const [r1, g1, b1] = rgb1;
    const [r2, g2, b2] = rgb2;
    return Math.sqrt(
        Math.pow(r1 - r2, 2) +
        Math.pow(g1 - g2, 2) +
        Math.pow(b1 - b2, 2)
    );
  }
  
  // Function to find images with similar rgbs
  function findSimilarjeans(color1, color2, color3, color4, contrastColor, threshold) {
    const inputRgbArray = [
        rgbStringToArray(color1),
        rgbStringToArray(color2),
        rgbStringToArray(color3),
        rgbStringToArray(color4),
        rgbStringToArray(contrastColor)
    ];

    jeans_image_filtered = jeansGot.filter(item => {
        const itemRgb = rgbStringToArray(item.rgb);
        return inputRgbArray.some(inputRgb => colorDistance(inputRgb, itemRgb) <= threshold);
    });

    // Clear previous images before displaying new ones
    document.getElementById("images").innerHTML = '';

    for (let i = 0; i < jeans_image_filtered.length; i++) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        
        const img = document.createElement('img');
        img.src = jeans_image_filtered[i].base64;
        let id = jeans_image_filtered[i]._id;
        img.alt = `Jeans Image ${i + 1}`;
        console.log(jeans_image_filtered[1])
        // Add click event to open product details or perform an action
        img.addEventListener('click', () => {
            // You can customize this to open a modal, redirect to product page, etc.
            window.open(`/product/${id}`, '_blank');
        });

        imgContainer.appendChild(img);
        document.getElementById("images").appendChild(imgContainer);
    }
    return jeans_image_filtered;
}


// Function to find images with similar colors
function findSimilarUppers(color1, color2, color3, color4, contrastColor, threshold) {
  const inputRgbArray = [
    rgbStringToArray(color1),
    rgbStringToArray(color2),
    rgbStringToArray(color3),
    rgbStringToArray(color4),
    rgbStringToArray(contrastColor)
  ];
 
  upper_image_filtered = upperGot.filter((item) => {
    const itemRgb = rgbStringToArray(item.rgb);
    return inputRgbArray.some(inputRgb => colorDistance(inputRgb, itemRgb) <= threshold);
  });

  // Clear previous images before displaying new ones
  document.getElementById("images").innerHTML = '';

  for (let i = 0; i < upper_image_filtered.length; i++) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    
    const img = document.createElement('img');
    img.src = upper_image_filtered[i].base64;
    let id = upper_image_filtered[i]._id;
    img.alt = `Upper Image ${i + 1}`;
    
    // Add click event to open product details or perform an action
    img.addEventListener('click', () => {
        // You can customize this to open a modal, redirect to product page, etc.
        window.open(`/product/${id}`, '_blank');
    });

    imgContainer.appendChild(img);
    document.getElementById("images").appendChild(imgContainer);
  }

  return upper_image_filtered;
}

function findSimilarLowers(color1, color2, color3, color4, contrastColor, threshold) {
  const inputRgbArray = [
    rgbStringToArray(color1),
    rgbStringToArray(color2),
    rgbStringToArray(color3),
    rgbStringToArray(color4),
    rgbStringToArray(contrastColor)
  ];
 
  lower_image_filtered = lowerGot.filter((item) => {
    const itemRgb = rgbStringToArray(item.rgb);
    return inputRgbArray.some(inputRgb => colorDistance(inputRgb, itemRgb) <= threshold);
  });

  // Clear previous images before displaying new ones
  document.getElementById("images").innerHTML = '';

  for (let i = 0; i < lower_image_filtered.length; i++) {
    const imgContainer = document.createElement('div');
    imgContainer.className = 'image-container';
    
    const img = document.createElement('img');
    img.src = lower_image_filtered[i].base64;
    let id = lower_image_filtered[i]._id;
    img.alt = `Lower Image ${i + 1}`;
    
    // Add click event to open product details or perform an action
    img.addEventListener('click', () => {
        // You can customize this to open a modal, redirect to product page, etc.
        window.open(`/product/${id}`, '_blank');
    });

    imgContainer.appendChild(img);
    document.getElementById("images").appendChild(imgContainer);
  }

  return lower_image_filtered;
}

const tshirts = () => {
  fetch(`/api/${shopName}/tshirts_images`) 
      .then((response) => {
          return response.json();
      })
      .then((fetchedImages) => {
        upperGot=fetchedImages.tshirts_images;
      })
      .catch((error) => {
          console.error('Error fetching images:', error); // Handle any errors
      });
};

tshirts();


const jeans = () => {
  fetch(`/api/${shopName}/jeans_images`) 
      .then((response) => {
          return response.json();
      })
      .then((fetchedImages) => {
        jeansGot=fetchedImages.jeans_images;
      })
      .catch((error) => {
          console.error('Error fetching images:', error); // Handle any errors
      });
};

jeans();

const lower = () => {
  fetch(`/api/${shopName}/lower_images`) 
      .then((response) => {
          return response.json();
      })
      .then((fetchedImages) => {
        lowerGot=fetchedImages.lower_images;
      })
      .catch((error) => {
          console.error('Error fetching images:', error); // Handle any errors
      });
};

lower();