/*
@codescope
@title Squared Distance Between Two Points
@result distSquared
@input target=x1 value=1 min=-20 max=20 step=1
@input target=y1 value=2 min=-20 max=20 step=1
@input target=x2 value=4 min=-20 max=20 step=1
@input target=y2 value=6 min=-20 max=20 step=1
*/
import java.util.Scanner;

public class B09_SquaredDistance {
    public static void main(String[] args) {
        Scanner input = new Scanner(System.in);
        int x1;
        int y1;
        int x2;
        int y2;
        int dx;
        int dy;
        int distSquared;

        System.out.print("Enter x and y of the first point: ");
        x1 = input.nextInt();
        y1 = input.nextInt();
        System.out.print("Enter x and y of the second point: ");
        x2 = input.nextInt();
        y2 = input.nextInt();
        dx = x2 - x1;
        dy = y2 - y1;
        distSquared = dx * dx + dy * dy;
        System.out.println("Squared distance: " + distSquared);
    }
}
