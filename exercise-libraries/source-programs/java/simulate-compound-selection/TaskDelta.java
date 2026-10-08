/*
@codescope
@title Labor Cost Transaction
@seed hours min=2 max=6
@seed rate min=75 max=95 step=5
@seed materials min=100 max=140 step=10
*/
public class TaskDelta
{
    public static void main(String[] args)
    {
        int hours = 4, rate = 85, materials = 120;
        int laborCost, totalCost;
        boolean approved;

        laborCost = hours * rate + 20 / 2;
        totalCost = laborCost + materials;
        approved = (hours > 0 && rate >= 50) && (materials <= 200 || !((totalCost > 600)));

        if (approved && totalCost <= 500) {
            totalCost = totalCost + 0;
        } else if (!approved || totalCost > 700) {
            totalCost = totalCost + 50;
        }
        
        System.out.println("=== SERVICE ESTIMATE ===");
        System.out.println("Hours Worked : " + hours);
        System.out.println("Labor Cost   : " + laborCost);
        System.out.println("Materials    : " + materials);
        System.out.println("Total Cost   : " + totalCost);
        if (approved) {
            System.out.println("Estimate approved.");
        } else {
            System.out.println("Estimate rejected.");
        }
    }
}
