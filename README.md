# Temporal Choropleth Map of U.K. Retailer Sales

This is a temporal [choropleth map](https://en.wikipedia.org/wiki/Choropleth_map) reflecting the sames of an anonymous U.K. retailer over 2011.

A live demo can be found [here](https://paul-tqh-nguyen.github.io/temporal_sales_choropleth_uk_retailer/).

The data can be found  [here](https://www.kaggle.com/carrie1/ecommerce-data).

Feel free to  [reach out](https://paul-tqh-nguyen.github.io/about/#contact)  for help or report problems or make suggestions for improvement!

### Tools Used

The following tools were heavily utilized to create this visualization:
* [D3.js](https://d3js.org/)
* [Pandas](https://pandas.pydata.org/)
* [Pandarallel](https://github.com/nalepae/pandarallel)

We also used the Python libraries for [json](https://docs.python.org/3/library/json.html), [datetime](https://docs.python.org/3/library/datetime.html), [tqdm](https://github.com/tqdm/tqdm), [numpy](https://numpy.org/), and [multiprocessing](https://docs.python.org/3/library/multiprocessing.html).

### Usage

Use the slider at at the bottom to select a date.

Hover over a country to show the sales information for the country in a tooltip.

The sales information reveals sales to date, number of unique customers to date, etc.

Grey countries are countries where no purchases took place.

White countries denote a country that have made purchases but none so far.

Use the play/pause button to have the slider automatically progress over time. Hover-over tooltips are updated accordingly.