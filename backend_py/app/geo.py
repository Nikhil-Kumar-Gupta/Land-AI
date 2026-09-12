"""Approximate district headquarters coordinates (WGS84) for the districts in the dataset.

The dataset has no case coordinates, so cases are mapped at district level only. Districts not listed here
are imported without a location and are simply not drawn on the map (coordinates are never invented).
"""

DISTRICT_CENTROIDS: dict[tuple[str, str], tuple[float, float]] = {
    ("Andhra Pradesh", "NTR"): (16.5062, 80.6480),
    ("Andhra Pradesh", "Visakhapatnam"): (17.6868, 83.2185),
    ("Andhra Pradesh", "Tirupati"): (13.6288, 79.4192),
    ("Andhra Pradesh", "Krishna"): (16.1875, 81.1389),
    ("Andhra Pradesh", "Guntur"): (16.3067, 80.4365),
    ("Karnataka", "Dharwad"): (15.4589, 75.0078),
    ("Karnataka", "Bengaluru Rural"): (13.2846, 77.5410),
    ("Karnataka", "Tumakuru"): (13.3379, 77.1173),
    ("Karnataka", "Belagavi"): (15.8497, 74.4977),
    ("Karnataka", "Mysuru"): (12.2958, 76.6394),
    ("Maharashtra", "Nashik"): (19.9975, 73.7898),
    ("Maharashtra", "Nagpur"): (21.1458, 79.0882),
    ("Maharashtra", "Aurangabad"): (19.8762, 75.3433),
    ("Maharashtra", "Pune"): (18.5204, 73.8567),
    ("Maharashtra", "Kolhapur"): (16.7050, 74.2433),
    ("Odisha", "Ganjam"): (19.3149, 84.7941),
    ("Odisha", "Sambalpur"): (21.4669, 83.9812),
    ("Odisha", "Khordha"): (20.1823, 85.6168),
    ("Odisha", "Cuttack"): (20.4625, 85.8830),
    ("Odisha", "Puri"): (19.8135, 85.8312),
    ("Telangana", "Nalgonda"): (17.0575, 79.2684),
    ("Telangana", "Hyderabad"): (17.3850, 78.4867),
    ("Telangana", "Warangal"): (17.9689, 79.5941),
    ("Telangana", "Medchal-Malkajgiri"): (17.5600, 78.5400),
    ("Telangana", "Rangareddy"): (17.2500, 78.3000),
}
