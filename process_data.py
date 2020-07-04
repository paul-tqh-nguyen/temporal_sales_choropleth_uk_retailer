#!/usr/bin/python3
'#!/usr/bin/python3 -OO'

'''
'''

# @todo update doc string

###########
# Imports #
###########

import json
import tqdm
import datetime
import pandas as pd
import numpy as np
import multiprocessing as mp
from pandarallel import pandarallel

from misc_utilities import *

###########
# Globals #
###########

pandarallel.initialize(nb_workers=mp.cpu_count(), progress_bar=False, verbose=0)

# https://github.com/holtzy/D3-graph-gallery/blob/master/DATA/world.geojson
WORLD_GEOJSON_FILE_LOCATION = './data/world.geojson'

# https://www.kaggle.com/carrie1/ecommerce-data
ECOMMERCE_DATA_CSV_FILE_LOCATION = './data/data.csv'

OUTPUT_GEOJSON_FILE_LOCATION = './data/processed_data.geojson'

###################
# Data Processing #
###################

class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (datetime.datetime, datetime.date)):
            return obj.isoformat()
        else:
            return super(CustomEncoder, self).default(obj)

###################
# Data Processing #
###################

def clean_ecommerce_data(ecommerce_df: pd.DataFrame) -> pd.DataFrame:
    ecommerce_df.InvoiceDate = pd.to_datetime(ecommerce_df.InvoiceDate, format='%m/%d/%Y %H:%M').dt.date
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.CustomerID != ecommerce_df.CustomerID], inplace=True)
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.Country == 'Unspecified'], inplace=True)
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.Country == 'European Community'], inplace=True) # 'European Community' is underspecified
    # Too small to visualize
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.Country == 'Malta'], inplace=True)
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.Country == 'Singapore'], inplace=True)
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.Country == 'Channel Islands'], inplace=True)
    ecommerce_df.drop(ecommerce_df.index[ecommerce_df.Country == 'Bahrain'], inplace=True)
    ecommerce_df = ecommerce_df.astype({'CustomerID': int}, copy=False)
    assert len(ecommerce_df[ecommerce_df.isnull().any(axis=1)])==0, 'Raw data contains NaN'
    return ecommerce_df

def clean_geo_data(world_geojson_data: dict) -> dict:
    for feature in world_geojson_data['features']:
        if feature['properties']['name'] == 'England':
            feature['properties']['name'] = 'United Kingdom'
        elif feature['properties']['name'] == 'Ireland':
            feature['properties']['name'] = 'EIRE'
        elif feature['properties']['name'] == 'South Africa':
            feature['properties']['name'] = 'RSA'
    return world_geojson_data

def combine_ecommerce_and_geo_data(ecommerce_df: pd.DataFrame, world_geojson_data: dict) -> dict:
    ecommerce_df['AmountPaid'] = ecommerce_df.parallel_apply(lambda row: row.UnitPrice * row.Quantity, axis=1)
    ecommerce_aggregate_df = ecommerce_df[['Country']].copy().set_index('Country')
    assert ecommerce_df[['InvoiceNo', 'InvoiceDate']].groupby('InvoiceNo').agg({'InvoiceDate': 'nunique'}).InvoiceDate.unique().item() == 1, "Invoices spanning multiple days not yet supported."
    class PlusIsUnionSet(set):
        def __add__(self, other):
            return PlusIsUnionSet(self.union(other))
    cummulative_df = ecommerce_df.groupby(['Country','InvoiceDate']) \
                                 .agg({
                                     'InvoiceNo': 'nunique',
                                     'Quantity': 'sum',
                                     'AmountPaid': 'sum',
                                     'CustomerID': PlusIsUnionSet,
                                     'StockCode': PlusIsUnionSet,
                                 }) \
                                 .sort_index(ascending=True)
    cummulative_df['InvoiceCountToDate'] = cummulative_df.InvoiceNo.cumsum()
    cummulative_df['QuantitySoldToDate'] = cummulative_df.Quantity.cumsum()
    cummulative_df['AmountPaidToDate'] = cummulative_df.AmountPaid.cumsum()
    cummulative_df['UniqueCustomerIDCountToDate'] = cummulative_df.CustomerID.cumsum().map(len) # parallel_map slower
    cummulative_df['UniqueStockCodeCountToDate'] = cummulative_df.StockCode.cumsum().map(len) # parallel_map slower
    cummulative_df.drop(columns=['InvoiceNo', 'Quantity', 'AmountPaid', 'CustomerID', 'StockCode'], inplace=True)
    cummulative_df = cummulative_df.reset_index().set_index(['Country'])
    country_names = set(cummulative_df.index)
    for feature in world_geojson_data['features']:
        feature_country_name = feature['properties']['name']
        if feature_country_name in country_names:
            country_df = cummulative_df.loc[feature_country_name].copy()
            if isinstance(country_df, pd.Series):
                country_df = cummulative_df.loc[feature_country_name].to_frame().transpose()
            country_df.set_index('InvoiceDate', inplace=True)
            sales_info_dict = recursive_defaultdict()
            for date, info in country_df.to_dict(orient='index').items():
                sales_info_dict[date.year][date.month][date.day] = info
            feature['properties']['salesData'] = sales_info_dict
    world_geojson_data['earliestDate'] = cummulative_df.InvoiceDate.min()
    world_geojson_data['latestDate'] = cummulative_df.InvoiceDate.max()
    world_geojson_data['maximumTotalRevenue'] = cummulative_df.AmountPaidToDate.max()
    return world_geojson_data

##########
# Driver #
##########

@debug_on_error
def main() -> None:
    ecommerce_df = pd.read_csv(ECOMMERCE_DATA_CSV_FILE_LOCATION, encoding='ISO-8859-1')
    ecommerce_df = clean_ecommerce_data(ecommerce_df)
    with open(WORLD_GEOJSON_FILE_LOCATION, 'r') as file_handle:
        world_geojson_data = json.load(file_handle)
    world_geojson_data = clean_geo_data(world_geojson_data)
    assert set(ecommerce_df.Country.unique()).issubset({feature['properties']['name'] for feature in world_geojson_data['features']})
    world_geojson_data = combine_ecommerce_and_geo_data(ecommerce_df, world_geojson_data)
    with open(OUTPUT_GEOJSON_FILE_LOCATION, 'w') as file_handle:
        json.dump(world_geojson_data, file_handle, indent=4, cls=CustomEncoder)
    return

if __name__ == '__main__':
    main()
 
