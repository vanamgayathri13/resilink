using { resilink as db } from '../db/schema';

@path: '/resilink'
service ResilinkService {

    entity Plants as projection on db.Plants;
    entity Suppliers as projection on db.Suppliers;
    entity Inventory as projection on db.Inventory;
    entity Disruptions as projection on db.Disruptions;

    action analyzeDisruption(disruptionID: String) returns String;

    action approveRecovery(disruptionID: String) returns String;

    action rejectRecovery(disruptionID: String) returns String;
}