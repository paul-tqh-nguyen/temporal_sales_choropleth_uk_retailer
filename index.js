
const parseTimestamp = (timestampStr) => new Date(new Date(timestampStr).getTime() + (new Date(timestampStr).getTimezoneOffset() * 60 * 1000));

const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
};

const interpolate = (start, end, floatValue) => {
    return start + Math.pow(floatValue, 0.25) * (end - start);
};

const createColorInterpolator = (startHexColor, endHexColor) => {
    const [startR, startG, startB] = hexToRgb(startHexColor);
    const [endR, endG, endB] = hexToRgb(endHexColor);
    const colorInterpolator = (floatValue) => {
        const r = interpolate(startR, endR, floatValue);
        const g = interpolate(startG, endG, floatValue);
        const b = interpolate(startB, endB, floatValue);
        return `rgb(${r}, ${g}, ${b})`;
    };
    return colorInterpolator;
};

const dayBefore = (date) => new Date(date.getTime() - 1000 * 3600 * 24);
const dayAfter = (date) => new Date(date.getTime() + 1000 * 3600 * 24);

const choroplethMain = () => {
    
    const geoJSONLocation = './data/processed_data.geojson';

    const plotContainer = document.getElementById('main-display');
    const svg = d3.select('#choropleth-svg');
    const landMassesGroup = svg.append('g').attr('id', 'land-masses-group');
    const toolTipGroup = svg.append('g').attr('id', 'tool-tip-group');
    const sliderGroup = svg.append('g').attr('id', 'slider-group');
    const sliderBoundingBox = sliderGroup.append('rect');
    const playButtonGroup = svg.append('g').attr('id', 'play-button-group');
    const playButtonBoundingBox = playButtonGroup.append('rect').attr('id', 'play-button');
    const playButtonText = playButtonGroup.append('text').attr('id', 'play-button-text');
    
    const toolTipFontSize = 12;
    const toolTipTextPadding = 10;
    const toolTipMargin = 10;

    const sliderWidthPortion = 0.50;
    const sliderHorizontalOffsetPortion = 0.35;
    const sliderVerticalOffsetPortion = 0.92;
    const sliderTopMargin = 10;
    const sliderPadding = 20;
    const sliderPeriod = 25;
    
    const playButtonHorizontalOffsetPortion = 0.10;
    const playButtonVerticalOffsetPortion = sliderVerticalOffsetPortion;
    const playButtonTextPadding = 20;

    const landMassWithoutPurchaseColor = '#cccccc';
    const landMassStartColor = '#eeeeee';
    const landMassEndColor = '#289e00';
    const colorMap = createColorInterpolator(landMassStartColor, landMassEndColor);
    
    d3.json(geoJSONLocation).then(data => {
        const earliestDate = dayBefore(parseTimestamp(new Date(Date.parse(data.earliestDate))));
        const latestDate = parseTimestamp(new Date(Date.parse(data.latestDate)));
        const numberOfDays = 1 + (latestDate - earliestDate) / (1000 * 60 * 60 *24);
        const maximumTotalRevenue = data.maximumTotalRevenue;
        const timeSlider = d3.sliderTop()
              .min(earliestDate)
              .max(latestDate)
              .step(1000 * 60 * 60 * 24)
              .tickFormat(d3.timeFormat('%m/%d/%Y'))
              .tickValues(d3.range(0, numberOfDays))
              .default(earliestDate);
        let timer;
        let toolTipTimer;
        
        const relevantSalesDataForDate = (date, salesData) => {
            let currentDate = parseTimestamp(new Date(date));
            let relevantSalesData = null;
            while (currentDate > earliestDate && !relevantSalesData) {
                const year = currentDate.getFullYear().toString();
                if (salesData[year]) {
                    const month = (currentDate.getMonth()+1).toString();
                    if (salesData[year][month]) {
                        const day = currentDate.getDate().toString();
                        if (salesData[year][month][day]) {
                            relevantSalesData = salesData[year][month][day];
                        }
                    }
                }
                currentDate = dayBefore(currentDate);
            }
            return relevantSalesData; 
        };
        
        const updateToolTip = (mouseX, mouseY, datum) => {
            const toolTipBoundingBox = d3.select('#tool-tip-bounding-box');
            toolTipGroup.selectAll('text').remove();
            const relevantSalesData = datum.properties.salesData ? relevantSalesDataForDate(timeSlider.value(), datum.properties.salesData) : null;
            const toolTipTextLines = relevantSalesData ? [
                `Country: ${datum.properties.name}`,
                `Invoice Count To Date: ${relevantSalesData.InvoiceCountToDate.toLocaleString()}`,
                `Quantity Sold To Date: ${relevantSalesData.QuantitySoldToDate.toLocaleString()}`,
                `Amount Paid To Date: $${(Math.round(relevantSalesData.AmountPaidToDate * 1e2) / 1e2).toLocaleString()}`,
                `Unique Customer ID Count To Date: ${relevantSalesData.UniqueCustomerIDCountToDate.toLocaleString()}`,
                `Unique Stock Code Count To Date: ${relevantSalesData.UniqueStockCodeCountToDate.toLocaleString()}`,
            ] : [
                `Country: ${datum.properties.name}`,
                `Invoice Count To Date: 0`,
                `Quantity Sold To Date: 0`,
                `Amount Paid To Date: $0.00`,
                `Unique Customer ID Count To Date: 0`,
                `Unique Stock Code Count To Date: 0`,
            ];
            const textLinesGroup = toolTipGroup.append('g');
            toolTipTextLines.forEach((textLine, textLineIndex) => {
                textLinesGroup
                    .append('text')
                    .style('font-size', toolTipFontSize)
                    .attr('id', 'tool-tip-text')
                    .attr('dx', toolTipTextPadding)
                    .attr('dy', `${(1+textLineIndex) * 1.2 * toolTipFontSize + toolTipTextPadding / 4}px`)
                    .text(textLine);
            });
            const textLinesGroupBBox = textLinesGroup.node().getBBox();
            const toolTipBoundingBoxWidth = textLinesGroupBBox.width + 2 * toolTipTextPadding;
            const toolTipBoundingBoxHeight = textLinesGroupBBox.height + toolTipTextPadding;
            const mouseCloserToRight = mouseX > parseFloat(svg.attr('width')) - mouseX;
            const toolTipX = mouseCloserToRight ? toolTipMargin : parseFloat(svg.attr('width')) - toolTipMargin - toolTipBoundingBoxWidth;
            const toolTipY = toolTipMargin;
            toolTipBoundingBox
                .attr('x', toolTipX)
                .attr('y', toolTipY)
                .attr('width', toolTipBoundingBoxWidth)
                .attr('height', toolTipBoundingBoxHeight);
            textLinesGroup.selectAll('*')
                .attr('x', toolTipX)
                .attr('y', toolTipY);
        };
        
        const renderLandMasses = (projection) => {
            const projectionFunction = d3.geoPath().projection(projection);
            const landmassData = data.features;
            const landMassesGroupSelection = landMassesGroup
                  .selectAll('path')
                  .data(landmassData);
            [landMassesGroupSelection, landMassesGroupSelection.enter().append('path')].forEach(selection => {
                selection
                    .attr('class', 'land-mass')
                    .attr('fill', datum => datum.properties.salesData ? landMassStartColor : landMassWithoutPurchaseColor)
                    .on('mouseover', function (datum) {
                        landMassesGroup
                            .selectAll('path')
                            .style('fill-opacity', 0.25);
                        d3.select(this)
                            .style('fill-opacity', 1);
                        const toolTipBoundingBox = toolTipGroup
                              .append('rect')
                              .style('stroke-width', 1)
                              .style('stroke', 'black')
                              .attr('id', 'tool-tip-bounding-box');
                        const [mouseX, mouseY] = d3.mouse(this);
                        toolTipTimer = setInterval(() => {
                            updateToolTip(mouseX, mouseY, datum);
                        }, sliderPeriod);
                    })
                    .on('mouseout', () => {
                        landMassesGroup
                            .selectAll('path')
                            .style('fill-opacity', 1);
                        clearInterval(toolTipTimer);
                        toolTipGroup.selectAll('*').remove();
                    })
                    .attr('d', datum => projectionFunction(datum));
            });
        };

        const updateLandMassFill = (sliderDate) => {
            const landmassData = data.features;
            landMassesGroup
                .selectAll('path')
                .data(landmassData)
                .style('fill', datum => {
                    if (datum.properties.salesData) {
                        const relevantSalesData = relevantSalesDataForDate(sliderDate, datum.properties.salesData);
                        const floatValue = relevantSalesData ? relevantSalesData.AmountPaidToDate / maximumTotalRevenue : 0;
                        return colorMap(floatValue);
                    } else {
                        return landMassWithoutPurchaseColor;
                    }
                });
        };
        
        const renderSlider = () => {;
            timeSlider
                .width(parseFloat(svg.attr('width')) * sliderWidthPortion)
                .on('onchange', updateLandMassFill);
            sliderGroup.call(timeSlider);
            sliderGroup
                .attr('transform', `translate(${parseFloat(svg.attr('width')) * sliderHorizontalOffsetPortion} ${parseFloat(svg.attr('height')) * sliderVerticalOffsetPortion})`);
            sliderGroup.selectAll('.tick').remove();
            sliderGroup.selectAll('.handle')
                .attr('d','M -5.5,-5.5 v 11 l 12,0 v -11 z');
            sliderGroup
                .selectAll('.parameter-value')
                .select('text')
                .attr('transform', 'translate(0 13)');
            sliderGroup.selectAll('.track-overlay').remove();
            sliderBoundingBox
                .attr('width', 0)
                .attr('height', 0);
            sliderGroup.select('.slider').raise();
            const sliderTrackInsetBoundingBox = sliderGroup.select('.track-inset').node().getBBox();
            const sliderTrackInsetX = sliderTrackInsetBoundingBox.x;
            const sliderTrackInsetY = sliderTrackInsetBoundingBox.y;
            const sliderTrackInsetWidth = sliderTrackInsetBoundingBox.width;
            const sliderTrackInsetHeight = sliderTrackInsetBoundingBox.height;
            sliderBoundingBox
                .attr('id', 'slider-bounding-box')
                .attr('x', sliderTrackInsetX - sliderPadding)
                .attr('y', sliderTrackInsetY - sliderPadding - sliderTopMargin)
                .attr('width', sliderTrackInsetWidth + 2 * sliderPadding)
                .attr('height', sliderTrackInsetHeight + 2 * sliderPadding + sliderTopMargin);
            sliderGroup.select('.slider').raise();
        };

        const renderPlayButton = () => {
            const sliderGroupBoundingBox = sliderGroup.node().getBBox();
            const renderPlayButton = (playButtonTextString) => {
                playButtonText
                    .text(playButtonTextString)
                    .attr('x', sliderGroupBoundingBox.x)
                    .attr('y', sliderGroupBoundingBox.y);
                playButtonBoundingBox
                    .attr('x', sliderGroupBoundingBox.x)
                    .attr('y', sliderGroupBoundingBox.y)
                    .attr('width', playButtonText.node().getBBox().width + 2 * playButtonTextPadding)
                    .attr('height', sliderBoundingBox.attr('height'));
                playButtonText
                    .attr('transform', `translate(${playButtonTextPadding} ${playButtonBoundingBox.node().getBBox().height / 2 + playButtonText.node().getBBox().height / 2})`);
            };
            renderPlayButton('Play');
            const stopTimer = () => {
                clearInterval(timer);
                renderPlayButton('Play');
            };
            const startTimer = () => {
                clearInterval(timer);
                timer = setInterval(() => {
                    if (timeSlider.value().getTime() >= latestDate.getTime()) {
                        clearInterval(timer);
                        renderPlayButton('Play');
                    } else {
                        timeSlider.value(dayAfter(timeSlider.value()));
                        updateLandMassFill(timeSlider.value());
                        renderPlayButton('Pause');
                    }
                }, sliderPeriod);
            };
            playButtonGroup
                .attr('x', sliderGroupBoundingBox.x)
                .attr('y', sliderGroupBoundingBox.y)
                .attr('transform', `translate(${parseFloat(svg.attr('width')) * playButtonHorizontalOffsetPortion} ${parseFloat(svg.attr('height')) * playButtonVerticalOffsetPortion})`)
                .on('click', () => {
                    if (playButtonText.text() === 'Play') {
                        if (timeSlider.value().getTime() == latestDate.getTime()) {
                            timeSlider.value(earliestDate);
                        }
                        startTimer();
                    } else {
                        stopTimer();
                    }
                });
        };
        
        const redraw = () => {
            svg
                .attr('width', `${window.innerWidth * 0.80}px`)
                .attr('height', `${window.innerHeight * 0.80}px`);
            const svgWidth = parseFloat(svg.attr('width'));
            const svgHeight = parseFloat(svg.attr('height'));
            
            const projection = d3.geoMercator().fitExtent([[0, 0], [svgWidth, svgHeight]], data);
            renderLandMasses(projection);
            
            const landMassesGroupBoundingBox = landMassesGroup.node().getBBox();
            const landMassesGroupWidth = landMassesGroupBoundingBox.width;
            const landMassesGroupHeight = landMassesGroupBoundingBox.height;
            if (svgWidth > landMassesGroupWidth) {
                svg.attr('width', landMassesGroupWidth);
                landMassesGroup.attr('transform', `translate(${-landMassesGroupBoundingBox.x} 0)`);
            }
            if (svgHeight > landMassesGroupHeight) {
                svg.attr('height', landMassesGroupHeight);
                landMassesGroup.attr('transform', `translate(0 ${-landMassesGroupBoundingBox.y})`);
            }

            renderSlider();
            renderPlayButton();            
        };
        redraw();
        window.addEventListener('resize', redraw);
    }).catch((error) => {
        console.error(error);
    });
};

choroplethMain();

const toggleHelp = () => {
    document.getElementById('help-display').classList.toggle('show');
    document.getElementById('main-display').classList.toggle('show');
};
