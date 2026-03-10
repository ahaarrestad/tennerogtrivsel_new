/**
 * Parser og validerer bilde-konfigurasjon (scale, posX, posY) med trygge defaults.
 * Brukes av sync-data.js (Node/bygg) og admin-client.js (nettleser).
 *
 * @param {*} scaleVal - Rå scale-verdi (string eller number)
 * @param {*} posXVal  - Rå posX-verdi (string eller number)
 * @param {*} posYVal  - Rå posY-verdi (string eller number)
 * @returns {{ scale: number, positionX: number, positionY: number }}
 */
export function parseImageConfig(scaleVal, posXVal, posYVal) {
    let scale = parseFloat(scaleVal);
    if (isNaN(scale) || scale < 1.0) {
        scale = 1.0;
    } else if (scale > 3.0) {
        scale = 3.0;
    }

    const parsedX = parseInt(posXVal, 10);
    const positionX = (!isNaN(parsedX) && parsedX >= 0 && parsedX <= 100) ? parsedX : 50;

    const parsedY = parseInt(posYVal, 10);
    const positionY = (!isNaN(parsedY) && parsedY >= 0 && parsedY <= 100) ? parsedY : 50;

    return { scale, positionX, positionY };
}
