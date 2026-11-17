import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Apiservice } from '../../services/apiservice';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SearchPipe } from '../../pipes/search-pipe';
@Component({
  selector: 'app-all-recipes',
  imports: [CommonModule, FormsModule,SearchPipe],
  templateUrl: './all-recipes.html',
  styleUrl: './all-recipes.css',
})
export class AllRecipes {
  recipes: any = []
  cuisineType: any = [] //to hold all the cuisines
  dummyRecipe: any = []
  nestedMealArray: any=[]
  singleMealArray:any=[]
  updatedMealArray:any=[]
  searchKey:string=''
  constructor(private api: Apiservice,private router: Router) { }
  ngOnInit(): void {
    this.getRecipe()
  }
  getRecipe() {
    this.api.getRecipeAPI().subscribe({
      next: (res: any) => {
        console.log(res);
        this.recipes = res.response
        this.dummyRecipe = res.response

        // cuisine type 
        this.recipes.forEach((item: any) => {
          !this.cuisineType.includes(item.cuisine) && this.cuisineType.push(item.cuisine)
        });
        console.log(this.cuisineType);
        //meal type
        this.nestedMealArray=this.recipes.map((item:any)=>item.mealType)
        console.log(this.nestedMealArray);
        this.singleMealArray=this.nestedMealArray.flat()
        console.log(this.singleMealArray);
        this.singleMealArray.map((item:any)=>{
          !this.updatedMealArray.includes(item) && this.updatedMealArray.push(item)
        })
        
      },
      error: (err) => {
        console.log("Api error" + err);

      }
    })
  }

  viewRecipe(id: string) {
  this.router.navigate(['/view-recipe', id]);
}

  filterRecipe(key: any, value: any) {
    this.recipes = this.dummyRecipe.filter((item: any) => item[key].includes(value))
  }

}
