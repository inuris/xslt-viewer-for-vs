
import { getBase64Map } from './base64_manager.js';

let widgets = [];
let decorations = [];

// Modal Elements
let modal, previewImg, widthInput, heightInput, ratioCheckbox, infoDiv, cancelBtn, okBtn;
let currentFile = null;
let currentWidget = null;
let originalWidth = 0;
let originalHeight = 0;
let aspectRatio = 0;

let onReplaceCallback = null;
let revealLineCallback = null;
let _monaco = null;

export function initBase64Support(editor, monacoInstance, onReplace, onRevealLine) {
    onReplaceCallback = onReplace;
    revealLineCallback = onRevealLine;
    _monaco = monacoInstance;
    // Initialize Modal Elements
    modal = document.getElementById('imageResizeModal');
    previewImg = document.getElementById('resizePreviewImage');
    widthInput = document.getElementById('resizeWidth');
    heightInput = document.getElementById('resizeHeight');
    ratioCheckbox = document.getElementById('resizeAspectRatio');
    infoDiv = document.getElementById('resizeInfo');
    cancelBtn = document.getElementById('resizeCancelBtn');
    okBtn = document.getElementById('resizeOkBtn');

    if (modal) {
        bindModalEvents(editor);
    }

    // Debounce the update
    let timeout;
    const update = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => updateBase64Widgets(editor, monacoInstance), 500);
    };

    editor.onDidChangeModelContent(update);
    
    // Initial run
    setTimeout(() => updateBase64Widgets(editor, monacoInstance), 1000);
}

function bindModalEvents(editor) {
    // Close Modal
    const closeModal = () => {
        modal.style.display = 'none';
        previewImg.src = '';
        currentFile = null;
        currentWidget = null;
    };

    cancelBtn.onclick = closeModal;
    window.onclick = (event) => {
        if (event.target == modal) closeModal();
    };

    // Input Changes
    widthInput.oninput = () => {
        if (ratioCheckbox.checked && aspectRatio) {
            heightInput.value = Math.round(widthInput.value / aspectRatio);
        }
        updateInfo();
    };

    heightInput.oninput = () => {
        if (ratioCheckbox.checked && aspectRatio) {
            widthInput.value = Math.round(heightInput.value * aspectRatio);
        }
        updateInfo();
    };

    // Insert Action
    okBtn.onclick = () => {
        if (!currentFile || !currentWidget) return;

        const width = parseInt(widthInput.value);
        const height = parseInt(heightInput.value);

        if (!width || !height) {
            alert('Invalid dimensions');
            return;
        }

        processResize(currentFile, width, height, (base64) => {
            currentWidget.replaceCode(base64);
            closeModal();
        });
    };
}

function updateInfo() {
    const w = widthInput.value;
    const h = heightInput.value;
    const size = Math.round((w * h * 4) / 1024); // Approx raw size in KB
    infoDiv.textContent = `Original: ${originalWidth}x${originalHeight} | New: ${w}x${h}`;
}

function processResize(file, width, height, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Get Base64 (default to png for quality, or match original type if possible)
            // For simplicity, we use the file type or png
            const type = file.type || 'image/png';
            const base64 = canvas.toDataURL(type);
            callback(base64);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function openResizeModal(file, widget, targetWidth = null) {
    currentFile = file;
    currentWidget = widget;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        
        // Wait for image to load to get dimensions
        previewImg.onload = () => {
            originalWidth = previewImg.naturalWidth;
            originalHeight = previewImg.naturalHeight;
            aspectRatio = originalWidth / originalHeight;

            if (targetWidth) {
                widthInput.value = targetWidth;
                heightInput.value = Math.round(targetWidth / aspectRatio);
            } else {
                widthInput.value = originalWidth;
                heightInput.value = originalHeight;
            }
            
            updateInfo();
            modal.style.display = 'block';
            
            // Remove onload to prevent loops if src changes
            previewImg.onload = null;
        };
    };
    reader.readAsDataURL(file);
}

function updateBase64Widgets(editor, monaco) {
    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();
    // Regex to match placeholders
    const regex = /__BASE64_IMAGE_(\d+)__/g;
    const base64Map = getBase64Map();
    
    let match;
    const newDecorations = [];
    const newWidgets = [];
    const foundImages = [];
    
    // Clear old widgets
    widgets.forEach(w => editor.removeContentWidget(w));
    widgets = [];

    while ((match = regex.exec(text)) !== null) {
        const startPos = model.getPositionAt(match.index);
        const endPos = model.getPositionAt(match.index + match[0].length);
        
        const range = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
        const originalBase64 = base64Map[match[0]];

        // Decoration to style the placeholder
        newDecorations.push({
            range: range,
            options: {
                inlineClassName: 'base64-placeholder',
                stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
            }
        });

        // Collect for sidebar
        if (originalBase64) {
            foundImages.push({
                src: originalBase64,
                line: startPos.lineNumber,
                editor: editor, 
                range: range 
            });
        }
    }
    
    decorations = editor.deltaDecorations(decorations, newDecorations);
    widgets = newWidgets;

    updateImageSidebar(foundImages);
}

function updateImageSidebar(images) {
    const list = document.getElementById('image-list');
    const sidebar = document.getElementById('image-sidebar');
    const toggleBtn = document.getElementById('toggle-image-sidebar');
    
    if (!list || !sidebar) return;

    // Bind toggle if not already bound
    const header = sidebar.querySelector('.sidebar-header');
    if (header && !header.onclick) {
        header.onclick = () => {
            sidebar.classList.toggle('collapsed');
            if (toggleBtn) {
                toggleBtn.textContent = sidebar.classList.contains('collapsed') ? '«' : '»';
            }
        };
    }

    list.innerHTML = '';
    
    if (images.length === 0) {
        list.innerHTML = '<div style="padding:10px;color:#999;text-align:center">No images found</div>';
        return;
    }

    images.forEach((imgData, index) => {
        const item = document.createElement('div');
        item.className = 'image-list-item';
        item.title = `Line ${imgData.line}`;
        
        const img = document.createElement('img');
        img.src = imgData.src;
        
        const info = document.createElement('div');
        info.className = 'image-info';
        info.textContent = `... (Line ${imgData.line})`;

        img.onload = () => {
            info.textContent = `${img.naturalWidth} x ${img.naturalHeight} (Line ${imgData.line})`;
        };

        // Overlay with buttons
        const overlay = document.createElement('div');
        overlay.className = 'image-item-overlay';
        
        const btnEye = document.createElement('button');
        btnEye.className = 'image-action-btn';
        btnEye.innerHTML = `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M31.7966 15.3776C31.5107 14.9865 24.6992 5.80219 15.9998 5.80219C7.30037 5.80219 0.488619 14.9865 0.203056 15.3772C0.0711057 15.558 0 15.776 0 15.9998C0 16.2236 0.0711057 16.4416 0.203056 16.6224C0.488619 17.0134 7.30037 26.1977 15.9998 26.1977C24.6992 26.1977 31.5107 17.0134 31.7966 16.6227C31.9287 16.442 31.9999 16.224 31.9999 16.0001C31.9999 15.7763 31.9287 15.5582 31.7966 15.3776ZM15.9998 24.0879C9.59174 24.0879 4.04168 17.9921 2.39874 15.9992C4.03956 14.0047 9.57799 7.91206 15.9998 7.91206C22.4076 7.91206 27.9572 14.0068 29.6009 16.0007C27.9601 17.9952 22.4216 24.0879 15.9998 24.0879Z" fill="black"/>
<path d="M16.0016 9.67035C12.5114 9.67035 9.67188 12.5099 9.67188 16C9.67188 19.4902 12.5114 22.3297 16.0016 22.3297C19.4917 22.3297 22.3313 19.4902 22.3313 16C22.3313 12.5099 19.4917 9.67035 16.0016 9.67035ZM16.0016 20.2198C13.6747 20.2198 11.7818 18.3268 11.7818 16C11.7818 13.6732 13.6747 11.7803 16.0016 11.7803C18.3284 11.7803 20.2213 13.6732 20.2213 16C20.2213 18.3268 18.3284 20.2198 16.0016 20.2198Z" fill="black"/>
</svg>`;
        btnEye.title = 'Go to line';
        btnEye.onclick = (e) => {
            e.stopPropagation();
            if (revealLineCallback) {
                revealLineCallback(imgData.line);
            } else {
                imgData.editor.revealLineInCenter(imgData.line);
                imgData.editor.focus();
            }
        };

        const btnDownload = document.createElement('button');
        btnDownload.className = 'image-action-btn';
        btnDownload.innerHTML = `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M28.7356 19.3008C28.4704 19.3008 28.2161 19.4061 28.0285 19.5937C27.841 19.7812 27.7356 20.0356 27.7356 20.3008V23.7158C27.7356 24.5207 27.4159 25.2927 26.8467 25.8619C26.2775 26.431 25.5056 26.7508 24.7006 26.7508H7.30062C6.49569 26.7508 5.72373 26.431 5.15456 25.8619C4.58538 25.2927 4.26562 24.5207 4.26562 23.7158V20.3008C4.26562 20.0356 4.16027 19.7812 3.97273 19.5937C3.7852 19.4061 3.53084 19.3008 3.26562 19.3008C3.00041 19.3008 2.74605 19.4061 2.55852 19.5937C2.37098 19.7812 2.26563 20.0356 2.26562 20.3008V23.7158C2.26695 25.0507 2.79785 26.3306 3.7418 27.2746C4.68576 28.2186 5.96567 28.7495 7.30062 28.7508H24.7006C26.0356 28.7495 27.3155 28.2186 28.2594 27.2746C29.2034 26.3306 29.7343 25.0507 29.7356 23.7158V20.3008C29.7356 20.0356 29.6303 19.7812 29.4427 19.5937C29.2552 19.4061 29.0008 19.3008 28.7356 19.3008Z" fill="black"/>
<path d="M15.2871 22.22C15.3801 22.3137 15.4907 22.3881 15.6125 22.4389C15.7344 22.4897 15.8651 22.5158 15.9971 22.5158C16.1291 22.5158 16.2598 22.4897 16.3817 22.4389C16.5036 22.3881 16.6142 22.3137 16.7071 22.22L22.3971 16.53C22.5559 16.339 22.6379 16.0957 22.6271 15.8475C22.6163 15.5994 22.5136 15.3641 22.3389 15.1875C22.1642 15.0109 21.93 14.9057 21.682 14.8923C21.434 14.8789 21.1898 14.9583 20.9971 15.115L16.9971 19.115V4.25C16.9971 3.98478 16.8918 3.73043 16.7042 3.54289C16.5167 3.35536 16.2623 3.25 15.9971 3.25C15.7319 3.25 15.4775 3.35536 15.29 3.54289C15.1025 3.73043 14.9971 3.98478 14.9971 4.25V19.1L10.9971 15.1C10.8095 14.9124 10.555 14.8069 10.2896 14.8069C10.0243 14.8069 9.76976 14.9124 9.58212 15.1C9.39448 15.2876 9.28906 15.5421 9.28906 15.8075C9.28906 16.0729 9.39448 16.3274 9.58212 16.515L15.2871 22.22Z" fill="black"/>
</svg>`;
        btnDownload.title = 'Download image';
        btnDownload.onclick = (e) => {
            e.stopPropagation();
            const link = document.createElement('a');
            link.href = imgData.src;
            
            let ext = 'png';
            
            // Check magic numbers first for accuracy
            const commaIdx = imgData.src.indexOf(',');
            if (commaIdx > -1) {
                const data = imgData.src.substring(commaIdx + 1);
                if (data.startsWith('iVBOR')) {
                    ext = 'png';
                } else if (data.startsWith('/9j/')) {
                    ext = 'jpg';
                } else if (data.startsWith('R0lGOD')) {
                    ext = 'gif';
                } else if (data.startsWith('UklGR')) {
                    ext = 'webp';
                } else if (data.startsWith('PHN2Zy')) {
                    ext = 'svg';
                } else {
                    // Fallback to mime type if magic number check fails or is unknown
                    const match = imgData.src.match(/data:image\/([a-zA-Z0-9+]+);base64/);
                    if (match && match[1]) {
                        ext = match[1].replace('svg+xml', 'svg');
                    }
                }
            }

            link.download = `image_line_${imgData.line}.${ext}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        const btnEdit = document.createElement('button');
        btnEdit.className = 'image-action-btn';
        btnEdit.innerHTML = `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H22C22.5304 3 23.0391 3.21071 23.4142 3.58579C23.7893 3.96086 24 4.46957 24 5V10C24 10.2652 24.1054 10.5196 24.2929 10.7071C24.4804 10.8946 24.7348 11 25 11C25.2652 11 25.5196 10.8946 25.7071 10.7071C25.8946 10.5196 26 10.2652 26 10V5C26 3.93913 25.5786 2.92172 24.8284 2.17157C24.0783 1.42143 23.0609 1 22 1H5C3.93913 1 2.92172 1.42143 2.17157 2.17157C1.42143 2.92172 1 3.93913 1 5V22C1 23.0609 1.42143 24.0783 2.17157 24.8284C2.92172 25.5786 3.93913 26 5 26H10.5C10.7652 26 11.0196 25.8946 11.2071 25.7071C11.3946 25.5196 11.5 25.2652 11.5 25C11.5 24.7348 11.3946 24.4804 11.2071 24.2929C11.0196 24.1054 10.7652 24 10.5 24H5C4.46957 24 3.96086 23.7893 3.58579 23.4142C3.21071 23.0391 3 22.5304 3 22V5Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M28.5612 12.7575C28.3212 12.5174 28.0362 12.327 27.7225 12.1971C27.4089 12.0671 27.0727 12.0002 26.7332 12.0002C26.3937 12.0002 26.0575 12.0671 25.7439 12.1971C25.4302 12.327 25.1453 12.5174 24.9052 12.7575L13.1337 24.528C12.9888 24.673 12.8919 24.8591 12.8562 25.061L12.0152 29.826C11.9873 29.9844 11.9979 30.1472 12.0463 30.3005C12.0947 30.4539 12.1793 30.5934 12.293 30.7071C12.4068 30.8207 12.5463 30.9053 12.6997 30.9536C12.8531 31.0019 13.0159 31.0125 13.1742 30.9845L17.9387 30.1435C18.1406 30.1078 18.3267 30.011 18.4717 29.866L30.2432 18.095C30.4833 17.855 30.6737 17.57 30.8037 17.2563C30.9336 16.9427 31.0005 16.6065 31.0005 16.267C31.0005 15.9275 30.9336 15.5913 30.8037 15.2777C30.6737 14.964 30.4833 14.679 30.2432 14.439L28.5612 12.7575ZM26.3192 14.1715C26.3736 14.1171 26.4381 14.0739 26.5091 14.0444C26.5802 14.015 26.6563 13.9998 26.7332 13.9998C26.8101 13.9998 26.8863 14.015 26.9573 14.0444C27.0284 14.0739 27.0929 14.1171 27.1472 14.1715L28.8287 15.853C28.8831 15.9073 28.9263 15.9719 28.9558 16.0429C28.9852 16.1139 29.0004 16.1901 29.0004 16.267C29.0004 16.3439 28.9852 16.4201 28.9558 16.4911C28.9263 16.5621 28.8831 16.6267 28.8287 16.681L28.6952 16.8145L26.1852 14.305L26.3192 14.1715ZM24.7712 15.7195L27.2812 18.229L18.0612 27.448L17.5922 26.0405C17.5431 25.8932 17.4604 25.7594 17.3506 25.6496C17.2408 25.5398 17.107 25.4571 16.9597 25.408L15.5522 24.9385L24.7712 15.7195ZM14.2332 28.767L16.2732 28.407L15.8532 27.147L14.5932 26.727L14.2332 28.767Z" fill="black"/>
<path d="M14.4252 20.5C14.4252 20.7652 14.3198 21.0196 14.1323 21.2071C13.9447 21.3946 13.6904 21.5 13.4252 21.5H6.50018C6.32502 21.5 6.15292 21.454 6.00111 21.3667C5.84931 21.2793 5.72312 21.1535 5.63517 21.0021C5.54723 20.8506 5.50062 20.6786 5.50001 20.5035C5.49939 20.3283 5.5448 20.1561 5.63168 20.004L7.19968 17.258C8.13268 15.623 10.3237 15.242 11.7547 16.4655L11.9372 16.622L16.1982 10.9025C16.2766 10.7972 16.3751 10.7083 16.4879 10.6411C16.6007 10.5738 16.7256 10.5294 16.8556 10.5104C16.9855 10.4914 17.118 10.4982 17.2453 10.5304C17.3726 10.5626 17.4924 10.6195 17.5977 10.698C17.703 10.7764 17.7918 10.8749 17.8591 10.9877C17.9264 11.1005 17.9708 11.2254 17.9898 11.3554C18.0088 11.4853 18.002 11.6178 17.9698 11.7451C17.9376 11.8724 17.8806 11.9922 17.8022 12.0975L12.9022 18.6745C12.8203 18.7843 12.7168 18.8762 12.598 18.9444C12.4792 19.0126 12.3476 19.0556 12.2114 19.0709C12.0753 19.0861 11.9375 19.0732 11.8065 19.033C11.6756 18.9928 11.5543 18.926 11.4502 18.837L10.4552 17.9855C10.3433 17.8897 10.2116 17.8198 10.0696 17.7808C9.92754 17.7417 9.77864 17.7346 9.63352 17.7598C9.48839 17.785 9.35063 17.842 9.23008 17.9267C9.10953 18.0113 9.00917 18.1215 8.93618 18.2495L8.22268 19.5H13.4252C13.6904 19.5 13.9447 19.6053 14.1323 19.7929C14.3198 19.9804 14.4252 20.2348 14.4252 20.5Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M10 6.5C9.60603 6.5 9.21593 6.5776 8.85195 6.72836C8.48797 6.87913 8.15726 7.1001 7.87868 7.37868C7.6001 7.65726 7.37913 7.98797 7.22836 8.35195C7.0776 8.71593 7 9.10603 7 9.5C7 9.89397 7.0776 10.2841 7.22836 10.6481C7.37913 11.012 7.6001 11.3427 7.87868 11.6213C8.15726 11.8999 8.48797 12.1209 8.85195 12.2716C9.21593 12.4224 9.60603 12.5 10 12.5C10.7956 12.5 11.5587 12.1839 12.1213 11.6213C12.6839 11.0587 13 10.2956 13 9.5C13 8.70435 12.6839 7.94129 12.1213 7.37868C11.5587 6.81607 10.7956 6.5 10 6.5ZM9 9.5C9 9.23478 9.10536 8.98043 9.29289 8.79289C9.48043 8.60536 9.73478 8.5 10 8.5C10.2652 8.5 10.5196 8.60536 10.7071 8.79289C10.8946 8.98043 11 9.23478 11 9.5C11 9.76522 10.8946 10.0196 10.7071 10.2071C10.5196 10.3946 10.2652 10.5 10 10.5C9.73478 10.5 9.48043 10.3946 9.29289 10.2071C9.10536 10.0196 9 9.76522 9 9.5Z" fill="black"/>
</svg>`;
        btnEdit.title = 'Change image';
        btnEdit.onclick = (e) => {
            e.stopPropagation();
            // imgData.widget.handleClick(); // Widget removed
            
            // Re-implement handleClick logic here since widget is gone
            const img = new Image();
            img.onload = () => {
                const currentWidth = img.naturalWidth;
                
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        // We need a way to replace code without the widget instance
                        // We can pass a mock widget or change openResizeModal signature
                        // Let's create a mock object that has replaceCode
                        const mockWidget = {
                            replaceCode: (newBase64) => {
                                // We need to replace the placeholder with the new base64
                                // But wait, the editor only contains placeholders!
                                // We need to update the base64Cache and then trigger a save/reload
                                // Or we can replace the placeholder with a NEW placeholder
                                
                                // Actually, since we are editing the "real" content via the cache
                                // We should update the cache directly?
                                // No, the user might have edited the file (moved lines etc)
                                // So the placeholder is in the editor text.
                                
                                // Strategy:
                                // 1. Get the placeholder text from the range
                                const placeholder = imgData.editor.getModel().getValueInRange(imgData.range);
                                
                                // 2. Update the cache for this placeholder
                                import('./base64_manager.js').then(module => {
                                    const map = module.getBase64Map();
                                    if (map[placeholder]) {
                                        map[placeholder] = newBase64;
                                        // Trigger a save to persist changes to disk
                                        // The save function will re-attach the new base64
                                        if (onReplaceCallback) onReplaceCallback();
                                        
                                        // Force update sidebar to show new image
                                        if (_monaco) {
                                            updateBase64Widgets(imgData.editor, _monaco);
                                        }
                                    }
                                });
                            }
                        };
                        openResizeModal(file, mockWidget, currentWidth);
                    }
                };
                input.click();
            };
            img.src = imgData.src;
        };

        overlay.appendChild(btnEye);
        overlay.appendChild(btnDownload);
        overlay.appendChild(btnEdit);

        item.appendChild(img);
        item.appendChild(info);
        item.appendChild(overlay);
        
        list.appendChild(item);
    });
}


class Base64Widget {
    constructor(id, range, src, editor, monaco) {
        this.id = 'base64-widget-' + id;
        this.range = range;
        this.src = src;
        this.editor = editor;
        this.monaco = monaco;
        
        this.domNode = document.createElement('div');
        this.domNode.className = 'base64-widget-icon';
        this.domNode.innerHTML = `<svg width="14" height="14" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align: middle;">
<path d="M3 5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H22C22.5304 3 23.0391 3.21071 23.4142 3.58579C23.7893 3.96086 24 4.46957 24 5V10C24 10.2652 24.1054 10.5196 24.2929 10.7071C24.4804 10.8946 24.7348 11 25 11C25.2652 11 25.5196 10.8946 25.7071 10.7071C25.8946 10.5196 26 10.2652 26 10V5C26 3.93913 25.5786 2.92172 24.8284 2.17157C24.0783 1.42143 23.0609 1 22 1H5C3.93913 1 2.92172 1.42143 2.17157 2.17157C1.42143 2.92172 1 3.93913 1 5V22C1 23.0609 1.42143 24.0783 2.17157 24.8284C2.92172 25.5786 3.93913 26 5 26H10.5C10.7652 26 11.0196 25.8946 11.2071 25.7071C11.3946 25.5196 11.5 25.2652 11.5 25C11.5 24.7348 11.3946 24.4804 11.2071 24.2929C11.0196 24.1054 10.7652 24 10.5 24H5C4.46957 24 3.96086 23.7893 3.58579 23.4142C3.21071 23.0391 3 22.5304 3 22V5Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M28.5612 12.7575C28.3212 12.5174 28.0362 12.327 27.7225 12.1971C27.4089 12.0671 27.0727 12.0002 26.7332 12.0002C26.3937 12.0002 26.0575 12.0671 25.7439 12.1971C25.4302 12.327 25.1453 12.5174 24.9052 12.7575L13.1337 24.528C12.9888 24.673 12.8919 24.8591 12.8562 25.061L12.0152 29.826C11.9873 29.9844 11.9979 30.1472 12.0463 30.3005C12.0947 30.4539 12.1793 30.5934 12.293 30.7071C12.4068 30.8207 12.5463 30.9053 12.6997 30.9536C12.8531 31.0019 13.0159 31.0125 13.1742 30.9845L17.9387 30.1435C18.1406 30.1078 18.3267 30.011 18.4717 29.866L30.2432 18.095C30.4833 17.855 30.6737 17.57 30.8037 17.2563C30.9336 16.9427 31.0005 16.6065 31.0005 16.267C31.0005 15.9275 30.9336 15.5913 30.8037 15.2777C30.6737 14.964 30.4833 14.679 30.2432 14.439L28.5612 12.7575ZM26.3192 14.1715C26.3736 14.1171 26.4381 14.0739 26.5091 14.0444C26.5802 14.015 26.6563 13.9998 26.7332 13.9998C26.8101 13.9998 26.8863 14.015 26.9573 14.0444C27.0284 14.0739 27.0929 14.1171 27.1472 14.1715L28.8287 15.853C28.8831 15.9073 28.9263 15.9719 28.9558 16.0429C28.9852 16.1139 29.0004 16.1901 29.0004 16.267C29.0004 16.3439 28.9852 16.4201 28.9558 16.4911C28.9263 16.5621 28.8831 16.6267 28.8287 16.681L28.6952 16.8145L26.1852 14.305L26.3192 14.1715ZM24.7712 15.7195L27.2812 18.229L18.0612 27.448L17.5922 26.0405C17.5431 25.8932 17.4604 25.7594 17.3506 25.6496C17.2408 25.5398 17.107 25.4571 16.9597 25.408L15.5522 24.9385L24.7712 15.7195ZM14.2332 28.767L16.2732 28.407L15.8532 27.147L14.5932 26.727L14.2332 28.767Z" fill="black"/>
<path d="M14.4252 20.5C14.4252 20.7652 14.3198 21.0196 14.1323 21.2071C13.9447 21.3946 13.6904 21.5 13.4252 21.5H6.50018C6.32502 21.5 6.15292 21.454 6.00111 21.3667C5.84931 21.2793 5.72312 21.1535 5.63517 21.0021C5.54723 20.8506 5.50062 20.6786 5.50001 20.5035C5.49939 20.3283 5.5448 20.1561 5.63168 20.004L7.19968 17.258C8.13268 15.623 10.3237 15.242 11.7547 16.4655L11.9372 16.622L16.1982 10.9025C16.2766 10.7972 16.3751 10.7083 16.4879 10.6411C16.6007 10.5738 16.7256 10.5294 16.8556 10.5104C16.9855 10.4914 17.118 10.4982 17.2453 10.5304C17.3726 10.5626 17.4924 10.6195 17.5977 10.698C17.703 10.7764 17.7918 10.8749 17.8591 10.9877C17.9264 11.1005 17.9708 11.2254 17.9898 11.3554C18.0088 11.4853 18.002 11.6178 17.9698 11.7451C17.9376 11.8724 17.8806 11.9922 17.8022 12.0975L12.9022 18.6745C12.8203 18.7843 12.7168 18.8762 12.598 18.9444C12.4792 19.0126 12.3476 19.0556 12.2114 19.0709C12.0753 19.0861 11.9375 19.0732 11.8065 19.033C11.6756 18.9928 11.5543 18.926 11.4502 18.837L10.4552 17.9855C10.3433 17.8897 10.2116 17.8198 10.0696 17.7808C9.92754 17.7417 9.77864 17.7346 9.63352 17.7598C9.48839 17.785 9.35063 17.842 9.23008 17.9267C9.10953 18.0113 9.00917 18.1215 8.93618 18.2495L8.22268 19.5H13.4252C13.6904 19.5 13.9447 19.6053 14.1323 19.7929C14.3198 19.9804 14.4252 20.2348 14.4252 20.5Z" fill="black"/>
<path fill-rule="evenodd" clip-rule="evenodd" d="M10 6.5C9.60603 6.5 9.21593 6.5776 8.85195 6.72836C8.48797 6.87913 8.15726 7.1001 7.87868 7.37868C7.6001 7.65726 7.37913 7.98797 7.22836 8.35195C7.0776 8.71593 7 9.10603 7 9.5C7 9.89397 7.0776 10.2841 7.22836 10.6481C7.37913 11.012 7.6001 11.3427 7.87868 11.6213C8.15726 11.8999 8.48797 12.1209 8.85195 12.2716C9.21593 12.4224 9.60603 12.5 10 12.5C10.7956 12.5 11.5587 12.1839 12.1213 11.6213C12.6839 11.0587 13 10.2956 13 9.5C13 8.70435 12.6839 7.94129 12.1213 7.37868C11.5587 6.81607 10.7956 6.5 10 6.5ZM9 9.5C9 9.23478 9.10536 8.98043 9.29289 8.79289C9.48043 8.60536 9.73478 8.5 10 8.5C10.2652 8.5 10.5196 8.60536 10.7071 8.79289C10.8946 8.98043 11 9.23478 11 9.5C11 9.76522 10.8946 10.0196 10.7071 10.2071C10.5196 10.3946 10.2652 10.5 10 10.5C9.73478 10.5 9.48043 10.3946 9.29289 10.2071C9.10536 10.0196 9 9.76522 9 9.5Z" fill="black"/>
</svg>`;
        this.domNode.title = 'Click to replace image';
        this.domNode.onclick = (e) => {
            e.stopPropagation(); // Prevent editor cursor move if possible
            this.handleClick();
        };
    }

    getId() { return this.id; }
    getDomNode() { return this.domNode; }
    getPosition() {
        return {
            position: {
                lineNumber: this.range.startLineNumber,
                column: this.range.startColumn
            },
            preference: [this.monaco.editor.ContentWidgetPositionPreference.EXACT]
        };
    }

    handleClick() {
        // Get current image width first
        const img = new Image();
        img.onload = () => {
            const currentWidth = img.naturalWidth;
            
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    openResizeModal(file, this, currentWidth);
                }
            };
            input.click();
        };
        img.src = this.src;
    }

    replaceCode(newBase64) {
        this.editor.executeEdits('base64-replace', [{
            range: this.range,
            text: newBase64,
            forceMoveMarkers: true
        }]);
        
        if (onReplaceCallback) {
            onReplaceCallback();
        }
    }
}
